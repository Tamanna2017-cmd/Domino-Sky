import type {
  Airport,
  ConnectionMiss,
  CostBreakdown,
  Flight,
  FlightOutcome,
  FlightStatus,
  Metrics,
  SavedConnection,
  SimInput,
  SimResult,
  WeatherEvent,
} from './types';
import { ACTION_COSTS, DEFAULT_SETTINGS } from './config';
import { ferryMinutes, round1 } from './util';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CASCADE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * The network is a set of aircraft rotations (tail chains). A flight's real
 * departure is the latest of:
 *   1. its (possibly retimed) schedule,
 *   2. the inbound aircraft's arrival + minimum turnaround,
 *   3. the origin airport being open (weather closure) and having a departure
 *      slot under its hourly capacity,
 *   4. a connection hold the controller asked for.
 * Arrivals = departure + block time (+ en-route weather) and are held outside a
 * severity-3 closure (or diverted when the event allows diversion).
 *
 * The pass is iterated to a fixpoint: capacity slotting delays a departure,
 * which delays that aircraft's later legs, which changes the queue. Departures
 * are monotone (never move earlier between iterations), so it converges.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface SchedState {
  dep: number;
  arr: number;
  held: number;
  heldFor?: string;
  ferry: number;
  diverted: boolean;
  alt?: string;
  direct: boolean;
  prevOperated?: string;
  cancelled?: boolean;
}

interface Provisional {
  dep: number;
  arr: number;
  held: number;
  heldFor?: string;
  ferry: number;
  diverted: boolean;
  alt?: string;
  direct: boolean;
  prevOperated?: string;
}

interface SlotBook {
  take: (code: string, t: number) => number;
  reset: () => void;
}

export function simulateNetwork(input: SimInput): SimResult {
  const settings = { ...DEFAULT_SETTINGS, ...input.settings };
  const airports = new Map(input.airports.map((a) => [a.code, a] as const));
  const aircraftBy = new Map(input.aircraft.map((a) => [a.tailId, a] as const));
  const byId = new Map(input.flights.map((f) => [f.id, f] as const));
  const events = input.weather ?? [];
  const actions = input.actions ?? [];

  // ── Pre-emptive retiming shifts both schedule times of a flight ─────────────
  const shiftBy = new Map<string, number>();
  for (const a of actions) {
    if (a.type === 'retime' && a.flightId && a.minutes) {
      shiftBy.set(a.flightId, (shiftBy.get(a.flightId) ?? 0) + a.minutes);
    }
  }
  const schedDep = new Map<string, number>();
  const schedArr = new Map<string, number>();
  for (const f of input.flights) {
    const s = shiftBy.get(f.id) ?? 0;
    schedDep.set(f.id, f.schedDep + s);
    schedArr.set(f.id, f.schedArr + s);
  }
  const blockOf = (id: string) => Math.max(20, schedArr.get(id)! - schedDep.get(id)!);

  // ── Aircraft assignment: swaps exchange the remainder of two chains ────────
  const tailOf = new Map<string, string>();
  for (const f of input.flights) tailOf.set(f.id, f.tailId);
  for (const a of actions) {
    if (a.type === 'spare' && a.flightId && a.spareTailId) {
      if (!aircraftBy.has(a.spareTailId) || !byId.has(a.flightId)) continue;
      tailOf.set(a.flightId, a.spareTailId);
    }
  }
  for (const a of actions) {
    if (a.type !== 'swap' || !a.flightId || !a.otherFlightId) continue;
    const A = byId.get(a.flightId);
    const B = byId.get(a.otherFlightId);
    if (!A || !B) continue;
    const tA = tailOf.get(A.id);
    const tB = tailOf.get(B.id);
    if (!tA || !tB || tA === tB) continue;
    const acA = aircraftBy.get(tA);
    const acB = aircraftBy.get(tB);
    // Validity: same station, and each aircraft is big enough for the other leg.
    if (!acA || !acB || A.origin !== B.origin) continue;
    if (acA.seats < B.pax || acB.seats < A.pax) continue;
    const aIds = input.flights
      .filter((f) => tailOf.get(f.id) === tA && schedDep.get(f.id)! >= schedDep.get(A.id)!)
      .map((f) => f.id);
    const bIds = input.flights
      .filter((f) => tailOf.get(f.id) === tB && schedDep.get(f.id)! >= schedDep.get(B.id)!)
      .map((f) => f.id);
    for (const id of aIds) tailOf.set(id, tB);
    for (const id of bIds) tailOf.set(id, tA);
  }

  const chainByTail = new Map<string, string[]>();
  for (const ac of input.aircraft) chainByTail.set(ac.tailId, []);
  for (const f of input.flights) {
    const t = tailOf.get(f.id)!;
    if (!chainByTail.has(t)) chainByTail.set(t, []);
    chainByTail.get(t)!.push(f.id);
  }
  for (const list of chainByTail.values()) {
    list.sort((x, y) => schedDep.get(x)! - schedDep.get(y)! || x.localeCompare(y));
  }

  const book = makeSlotBook(airports, events);
  const cancelled = new Set(
    actions.filter((a) => a.type === 'cancel' && a.flightId).map((a) => a.flightId!),
  );
  const holdReq = new Map<string, number>();
  for (const a of actions) {
    if (a.type === 'hold' && a.flightId && a.minutes) {
      holdReq.set(a.flightId, Math.max(holdReq.get(a.flightId) ?? 0, a.minutes));
    }
  }
  // Reverse index: who is feeding passengers into a departure (for holds).
  const inboundBy = new Map<string, { fromId: string; pax: number }[]>();
  for (const f of input.flights) {
    for (const [toId, pax] of Object.entries(f.connectingPaxMap ?? {})) {
      if (!pax || pax <= 0) continue;
      const list = inboundBy.get(toId) ?? [];
      list.push({ fromId: f.id, pax });
      inboundBy.set(toId, list);
    }
  }
  const rebookEnabled = actions.some((a) => a.type === 'rebook');
  const diversionByAirport = new Set<string>();
  for (const ev of events) {
    if (ev.severity === 3 && ev.diversions) diversionByAirport.add(ev.airport);
  }

  const nearestAirport = (code: string): Airport | undefined => {
    const from = airports.get(code);
    if (!from) return undefined;
    let best: Airport | undefined;
    let bestD = Infinity;
    for (const ap of input.airports) {
      if (ap.code === code) continue;
      const d = Math.hypot(ap.lat - from.lat, ap.lon - from.lon);
      if (d < bestD) {
        bestD = d;
        best = ap;
      }
    }
    return best;
  };

  const weatherWithin = (code: string, t: number, buffer = 0): boolean =>
    events.some(
      (ev) =>
        ev.airport === code &&
        t >= ev.startTime - buffer &&
        t <= ev.startTime + ev.duration + buffer,
    );

  const enroutePenalty = (f: Flight): number => {
    let extra = 0;
    for (const ev of events) {
      if (ev.severity < 2) continue;
      const mid = (schedDep.get(f.id)! + schedArr.get(f.id)!) / 2;
      // Only weather around the arrival field adds airborne time; a departure
      // closure only delays the take-off itself (handled by the slot book).
      const inWindow =
        ev.airport === f.dest &&
        mid >= ev.startTime - 45 &&
        mid <= ev.startTime + ev.duration + 45;
      if (inWindow) extra = Math.max(extra, ev.severity * 5);
    }
    return extra;
  };

  const arrivalRule = (
    dest: string,
    rawArr: number,
  ): { arr: number; diverted: boolean; alt?: string; direct: boolean } => {
    for (const ev of events) {
      if (ev.airport !== dest || ev.severity < 3) continue;
      const end = ev.startTime + ev.duration;
      if (rawArr < ev.startTime || rawArr >= end) continue;
      if (diversionByAirport.has(dest)) {
        const alt = nearestAirport(dest);
        return { arr: rawArr + 45, diverted: true, alt: alt?.code, direct: true };
      }
      return { arr: end + 5, diverted: false, direct: true };
    }
    return { arr: rawArr, diverted: false, direct: false };
  };

  const runPass = (prev: Map<string, SchedState>, arrivalsPrev: Map<string, number>) => {
    const provisional = new Map<string, Provisional>();

    // Stage 1 — chain sequencing: turnaround, ferry, holds, arrival restrictions.
    for (const [tailId, ids] of chainByTail) {
      const ac = aircraftBy.get(tailId);
      if (!ac) continue;
      let pos = ac.base;
      let avail = ac.standby ? 9 * 60 : 4 * 60;
      let prevOperated: string | undefined;
      for (const id of ids) {
        const f = byId.get(id);
        if (!f) continue;
        const sd = schedDep.get(id)!;
        if (cancelled.has(id)) {
          provisional.set(id, {
            dep: sd,
            arr: schedArr.get(id)!,
            held: 0,
            ferry: 0,
            diverted: false,
            direct: false,
          });
          prevOperated = undefined;
          continue;
        }
        const prevState = prev.get(id);
        let ferry = 0;
        if (pos !== f.origin) {
          ferry = ferryMinutes(airports.get(pos), airports.get(f.origin));
          avail += ferry;
          pos = f.origin;
        }
        let dep = Math.max(sd, avail + settings.minTurnaround);
        let held = 0;
        let heldFor: string | undefined;
        const req = holdReq.get(id) ?? 0;
        if (req > 0) {
          let target = dep;
          for (const { fromId } of inboundBy.get(id) ?? []) {
            const inboundArr = arrivalsPrev.get(fromId);
            if (inboundArr == null) continue;
            const needed = inboundArr + settings.minConnect;
            if (needed > target) {
              target = needed;
              heldFor = fromId;
            }
          }
          const holdTo = Math.min(dep + req, target);
          if (holdTo > dep + 0.5) {
            held = holdTo - dep;
            dep = holdTo;
          }
        }
        if (prevState) dep = Math.max(dep, prevState.dep);

        const rawArr = dep + blockOf(id) + enroutePenalty(f);
        const rule = arrivalRule(f.dest, rawArr);
        let arr = rule.arr;
        if (prevState) arr = Math.max(arr, prevState.arr);

        provisional.set(id, {
          dep,
          arr,
          held,
          heldFor,
          ferry,
          diverted: rule.diverted,
          alt: rule.alt,
          direct:
            weatherWithin(f.origin, sd) ||
            weatherWithin(f.origin, dep, 30) ||
            rule.direct,
          prevOperated,
        });
        pos = rule.diverted && rule.alt ? rule.alt : f.dest;
        avail = arr;
        prevOperated = id;
      }
    }

    // Stage 2 — departure slot allocation under hourly capacity (time ordered).
    book.reset();
    const ordered = [...provisional.keys()].sort(
      (a, b) => provisional.get(a)!.dep - provisional.get(b)!.dep || a.localeCompare(b),
    );
    const state = new Map<string, SchedState>();
    for (const id of ordered) {
      const p = provisional.get(id)!;
      const f = byId.get(id)!;
      if (cancelled.has(id)) {
        state.set(id, { ...p, cancelled: true });
        continue;
      }
      let dep = book.take(f.origin, p.dep);
      const prevState = prev.get(id);
      if (prevState) dep = Math.max(dep, prevState.dep);
      const offset = p.arr - p.dep; // block + en-route + arrival holding/diversion
      state.set(id, { ...p, dep, arr: dep + offset });
    }
    return state;
  };

  // ── Iterate to a fixpoint, applying the cancellation rule each cycle ───────
  let state = new Map<string, SchedState>();
  let arrivals = new Map<string, number>();
  for (let iter = 0; iter < 12; iter++) {
    const next = runPass(state, arrivals);
    let newlyCancelled = 0;
    for (const [id, st] of next) {
      if (st.cancelled || cancelled.has(id)) continue;
      if (st.dep - schedDep.get(id)! > settings.cancelDelayThreshold) {
        cancelled.add(id);
        newlyCancelled++;
      }
    }
    const same = statesEqual(state, next);
    state = next;
    const nextArrivals = new Map<string, number>();
    for (const [id, st] of next) if (!st.cancelled) nextArrivals.set(id, st.arr);
    arrivals = nextArrivals;
    if (newlyCancelled === 0 && same && iter >= 3) break;
  }

  // ── Outcomes ──────────────────────────────────────────────────────────────
  const outcomes: Record<string, FlightOutcome> = {};
  const orderedIds = [...input.flights]
    .sort((a, b) => schedDep.get(a.id)! - schedDep.get(b.id)! || a.id.localeCompare(b.id))
    .map((f) => f.id);

  for (const id of orderedIds) {
    const f = byId.get(id)!;
    const st = state.get(id);
    if (!st) continue;
    const dep = st.cancelled ? null : st.dep;
    const arr = st.cancelled ? null : st.arr;
    const depDelay = dep == null ? 0 : dep - schedDep.get(id)!;
    const arrDelay = arr == null ? 0 : arr - schedArr.get(id)!;
    let status: FlightStatus = 'SCHEDULED';
    if (st.cancelled) status = 'CANCELLED';
    else if (st.diverted) status = 'DIVERTED';
    else if (arrDelay > settings.onTimeThreshold) status = 'DELAYED';
    outcomes[id] = {
      flightId: id,
      flightNo: f.flightNo,
      tailId: tailOf.get(id) ?? f.tailId,
      origin: f.origin,
      dest: f.dest,
      schedDep: schedDep.get(id)!,
      schedArr: schedArr.get(id)!,
      actualDep: dep,
      actualArr: arr,
      depDelay: Math.max(0, Math.round(depDelay)),
      arrDelay: Math.max(0, Math.round(arrDelay)),
      status,
      cause: 'NONE',
      cascadeDepth: 0,
      heldMinutes: Math.round(st.held),
      ferryMinutes: Math.round(st.ferry),
      directWeather: st.direct,
      alternate: st.alt,
      seats: aircraftBy.get(tailOf.get(id) ?? '')?.seats ?? 0,
    };
  }

  // ── Causal graph: root vs propagated, cascade depth ────────────────────────
  const byDepTime = [...orderedIds].sort(
    (a, b) =>
      (outcomes[a]?.actualDep ?? schedDep.get(a)!) - (outcomes[b]?.actualDep ?? schedDep.get(b)!) ||
      a.localeCompare(b),
  );
  for (const id of byDepTime) {
    const o = outcomes[id];
    if (!o) continue;
    const st = state.get(id);
    if (!st || st.cancelled) {
      o.cause = st?.direct ? 'ROOT_WEATHER' : 'NONE';
      o.cascadeDepth = 0;
      continue;
    }
    if (o.depDelay <= 5 && o.arrDelay <= 5) continue;
    const parentId = st.prevOperated;
    const parent = parentId ? outcomes[parentId] : undefined;
    if (parent && parent.arrDelay > 5) {
      o.cause = 'PROPAGATED';
      o.parentFlightId = parent.flightId;
      o.cascadeDepth = parent.cascadeDepth + 1;
      continue;
    }
    if (st.held > 0 && st.heldFor) {
      o.cause = 'PROPAGATED';
      o.connectionParentId = st.heldFor;
      o.cascadeDepth = (outcomes[st.heldFor]?.cascadeDepth ?? 0) + 1;
      continue;
    }
    o.cause = 'ROOT_WEATHER';
    o.cascadeDepth = 0;
  }

  // ── Connection analysis ────────────────────────────────────────────────────
  const misses: ConnectionMiss[] = [];
  const savedConnections: SavedConnection[] = [];
  for (const id of orderedIds) {
    const A = outcomes[id];
    if (!A || A.status === 'CANCELLED') continue;
    for (const [toId, pax] of Object.entries(byId.get(id)!.connectingPaxMap ?? {})) {
      if (!pax || pax <= 0) continue;
      const B = outcomes[toId];
      if (!B || B.actualDep == null) continue;
      if (B.status === 'DIVERTED') {
        misses.push({
          fromFlightId: id,
          toFlightId: toId,
          pax,
          airport: B.origin,
          arrivalTime: A.actualArr!,
          departureTime: B.actualDep,
        });
        continue;
      }
      const readyAt = A.actualArr! + settings.minConnect;
      if (readyAt > B.actualDep + 0.5) {
        misses.push({
          fromFlightId: id,
          toFlightId: toId,
          pax,
          airport: B.origin,
          arrivalTime: A.actualArr!,
          departureTime: B.actualDep,
        });
      } else if (B.heldMinutes > 0) {
        savedConnections.push({ fromFlightId: id, toFlightId: toId, pax });
      }
    }
  }

  // ── Passenger rebooking (optional lever) ──────────────────────────────────
  const seatsLeft = new Map<string, number>();
  const departuresByAirport = new Map<string, string[]>();
  for (const id of orderedIds) {
    const o = outcomes[id];
    if (o.status === 'CANCELLED' || o.status === 'DIVERTED') continue;
    const f = byId.get(id)!;
    seatsLeft.set(id, Math.max(0, (aircraftBy.get(o.tailId)?.seats ?? 0) - f.pax));
    const list = departuresByAirport.get(f.origin) ?? [];
    list.push(id);
    departuresByAirport.set(f.origin, list);
  }
  for (const list of departuresByAirport.values()) {
    list.sort((a, b) => (outcomes[a].actualDep ?? 0) - (outcomes[b].actualDep ?? 0));
  }

  const allocate = (pax: number, airport: string, notBefore: number): number => {
    if (!rebookEnabled || pax <= 0) return 0;
    let left = pax;
    for (const id of departuresByAirport.get(airport) ?? []) {
      const dep = outcomes[id].actualDep;
      if (dep == null || dep < notBefore) continue;
      const available = seatsLeft.get(id) ?? 0;
      if (available <= 0) continue;
      const take = Math.min(available, left);
      seatsLeft.set(id, available - take);
      left -= take;
      if (left <= 0) break;
    }
    return pax - left;
  };

  let paxMisconnected = 0;
  let paxRebooked = 0;
  for (const m of misses) {
    paxMisconnected += m.pax;
    paxRebooked += allocate(m.pax, m.airport, m.arrivalTime + settings.minConnect);
  }

  let paxOnCancelled = 0;
  for (const id of cancelled) {
    const f = byId.get(id);
    if (!f) continue;
    paxOnCancelled += f.pax;
    paxRebooked += allocate(f.pax, f.origin, f.schedDep + 90);
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  let totalDelayMin = 0;
  let directDelayMin = 0;
  let flightsDelayed = 0;
  let flightsOperated = 0;
  let flightsAffected = 0;
  let cancelledCount = 0;
  let divertedCount = 0;
  let onTime = 0;
  let maxDepth = 0;
  let delayCost = 0;
  let paxTotal = 0;
  const rootFlightIds: string[] = [];
  const cancelledIds: string[] = [];
  const divertedIds: string[] = [];

  for (const id of orderedIds) {
    const o = outcomes[id];
    const f = byId.get(id)!;
    paxTotal += f.pax;
    maxDepth = Math.max(maxDepth, o.cascadeDepth);
    if (o.status === 'CANCELLED') {
      cancelledCount++;
      cancelledIds.push(id);
      continue;
    }
    if (o.status === 'DIVERTED') {
      divertedCount++;
      divertedIds.push(id);
    }
    flightsOperated++;
    totalDelayMin += o.arrDelay;
    if (o.arrDelay > settings.onTimeThreshold) flightsDelayed++;
    if (o.arrDelay > 5) flightsAffected++;
    else if (o.status !== 'DIVERTED') onTime++;
    delayCost += o.arrDelay * (settings.delayCostPerMin + f.pax * settings.delayCostPerPaxMin);
    if (o.cause === 'ROOT_WEATHER') {
      directDelayMin += o.arrDelay;
      if (o.arrDelay > 5) rootFlightIds.push(id);
    }
  }

  const propagatedDelayMin = Math.max(0, totalDelayMin - directDelayMin);
  const cancellationCost =
    cancelledCount * settings.cancellationCost + divertedCount * settings.diversionCost;
  const paxStranded = Math.max(0, paxMisconnected + paxOnCancelled - paxRebooked);
  const passengerCost =
    paxMisconnected * settings.misconnectCost +
    paxStranded * settings.strandingCost +
    paxRebooked * settings.rebookCost;
  let recoveryCost = 0;
  for (const a of actions) {
    if (a.type === 'rebook') continue;
    recoveryCost += ACTION_COSTS[a.type];
  }

  const cost: CostBreakdown = {
    delay: Math.round(delayCost),
    cancellation: Math.round(cancellationCost),
    passenger: Math.round(passengerCost),
    recovery: Math.round(recoveryCost),
    total: Math.round(delayCost + cancellationCost + passengerCost + recoveryCost),
  };

  const metrics: Metrics = {
    flightsTotal: orderedIds.length,
    flightsOperated,
    flightsAffected,
    flightsDelayed,
    flightsCancelled: cancelledCount,
    flightsDiverted: divertedCount,
    totalDelayMin,
    directDelayMin,
    propagatedDelayMin,
    paxTotal,
    paxMisconnected,
    paxRebooked,
    paxStranded,
    paxOnCancelled,
    onTimePct: flightsOperated > 0 ? round1((onTime / flightsOperated) * 100) : 100,
    maxCascadeDepth: maxDepth,
    amplificationFactor:
      directDelayMin > 0 ? round1(totalDelayMin / directDelayMin) : 0,
    cost,
    estimatedCost: cost.total,
  };

  const chainRecord: Record<string, string[]> = {};
  for (const [tail, ids] of chainByTail) chainRecord[tail] = ids.filter((id) => !!outcomes[id]);

  return {
    outcomes,
    orderedIds,
    chainByTail: chainRecord,
    misses,
    savedConnections,
    rootFlightIds,
    cancelledIds,
    divertedIds,
    metrics,
  };
}

function statesEqual(a: Map<string, SchedState>, b: Map<string, SchedState>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, sa] of a) {
    const sb = b.get(id);
    if (!sb) return false;
    if (Math.abs(sa.dep - sb.dep) > 0.01 || Math.abs(sa.arr - sb.arr) > 0.01) return false;
    if ((sa.cancelled ?? false) !== (sb.cancelled ?? false)) return false;
    if (sa.prevOperated !== sb.prevOperated) return false;
  }
  return true;
}

/** Airport open/closed + capacity bookkeeping for one scheduling pass. */
function makeSlotBook(airports: Map<string, Airport>, events: WeatherEvent[]): SlotBook {
  const taken = new Map<string, number[]>();

  const capAt = (code: string, t: number): number => {
    const ap = airports.get(code);
    if (!ap) return 999;
    let cap = ap.hourlyCapacity;
    for (const ev of events) {
      if (ev.airport !== code) continue;
      const start = ev.startTime;
      const end = ev.startTime + ev.duration;
      if (ev.severity === 1) {
        if (t >= start - 20 && t <= end + 60) cap = Math.min(cap, Math.round(ap.hourlyCapacity * 0.5));
      } else if (t >= end && t <= end + 60) {
        // Congestion rebound after a stop: reduced acceptance while the queue drains.
        cap = Math.min(cap, Math.round(ap.hourlyCapacity * 0.72));
      }
    }
    return Math.max(1, cap);
  };

  const closureEnd = (code: string, t: number): number => {
    let end = t;
    for (const ev of events) {
      if (ev.airport !== code || ev.severity < 2) continue;
      const close = ev.startTime;
      const open = ev.startTime + ev.duration;
      if (t >= close && t < open) end = Math.max(end, open);
    }
    return end;
  };

  const take = (code: string, start: number): number => {
    let t = Math.max(start, closureEnd(code, start));
    const list = taken.get(code) ?? [];
    for (let guard = 0; guard < 600; guard++) {
      const ce = closureEnd(code, t);
      if (ce > t) {
        t = ce;
        continue;
      }
      const cap = capAt(code, t);
      let count = 0;
      let oldest = Infinity;
      for (const d of list) {
        if (d > t - 60 && d <= t) {
          count++;
          if (d < oldest) oldest = d;
        }
      }
      if (count < cap) break;
      t = oldest === Infinity ? t + 15 : Math.ceil(oldest) + 60;
    }
    list.push(t);
    taken.set(code, list);
    return t;
  };

  return { take, reset: () => taken.clear() };
}
