import type {
  Aircraft,
  Metrics,
  RecoveryAction,
  SimInput,
  SimResult,
} from './types';
import { simulateNetwork } from './simulate';
import { fmtMoney, fmtNumber, uid } from './util';

export interface Recommendation {
  id: string;
  action: RecoveryAction;
  title: string;
  detail: string;
  risk: string;
  gain: number;
  deltaDelay: number;
  deltaPax: number;
  deltaCost: number;
  result: SimResult;
}

/** 0-100 recovery score relative to a do-nothing world. */
export function recoveryScore(m: Metrics, base: Metrics): number {
  const ratio = (v: number, b: number) => (b <= 0 ? 0 : Math.min(1.15, v / b));
  const delayPart = 50 * ratio(m.totalDelayMin, base.totalDelayMin);
  const paxPart = 30 * ratio(m.paxStranded, base.paxStranded);
  const costPart = 20 * ratio(m.estimatedCost, base.estimatedCost);
  return Math.max(0, Math.min(100, Math.round(100 - delayPart - paxPart - costPart)));
}

export function gradeOf(score: number): { grade: string; color: string; blurb: string } {
  if (score >= 85) return { grade: 'A', color: '#34d399', blurb: 'Network recovered — textbook ops.' };
  if (score >= 72) return { grade: 'B', color: '#22d3ee', blurb: 'Strong recovery, minor residual delay.' };
  if (score >= 60) return { grade: 'C', color: '#a78bfa', blurb: 'Solid, but delay leaked down the chains.' };
  if (score >= 45) return { grade: 'D', color: '#fbbf24', blurb: 'Recovery was partial — connections broke.' };
  return { grade: 'F', color: '#f87171', blurb: 'Cascade ran unchecked across the network.' };
}

interface CandidateSeed {
  action: RecoveryAction;
  title: string;
  risk: string;
}

const gainOf = (cur: Metrics, next: Metrics): number =>
  (cur.totalDelayMin - next.totalDelayMin) +
  (cur.paxStranded - next.paxStranded) * 25 +
  (cur.estimatedCost - next.estimatedCost) / 5000 -
  (next.flightsCancelled - cur.flightsCancelled) * 6;

export function buildRecommendations(
  input: SimInput,
  current: SimResult,
  baseline: SimResult,
  limit = 5,
): Recommendation[] {
  const actions = input.actions;
  const byId = new Map(input.flights.map((f) => [f.id, f]));
  const acBy = new Map(input.aircraft.map((a) => [a.tailId, a]));
  const keyOf = (a: RecoveryAction) =>
    `${a.type}|${a.flightId ?? ''}|${a.otherFlightId ?? ''}|${a.minutes ?? ''}|${a.spareTailId ?? ''}`;
  const existing = new Set(actions.map(keyOf));
  const seeds: CandidateSeed[] = [];
  const add = (action: RecoveryAction, title: string, risk: string) => {
    if (existing.has(keyOf(action))) return;
    existing.add(keyOf(action));
    seeds.push({ action, title, risk });
  };
  const mk = (partial: Omit<RecoveryAction, 'id' | 'createdAt'>): RecoveryAction => ({
    ...partial,
    id: uid('act'),
    createdAt: Date.now(),
  });

  const outs = current.outcomes;
  const operated = input.flights.filter((f) => outs[f.id] && outs[f.id].status !== 'CANCELLED');

  // 1. Rebook stranded passengers.
  if (!actions.some((a) => a.type === 'rebook') && current.metrics.paxMisconnected > 0) {
    add(
      mk({ type: 'rebook', note: 'Auto-rebook misconnected passengers on later departures' }),
      'Trigger automatic rebooking',
      'Low risk — uses only remaining seats, does not move aircraft.',
    );
  }

  // 2. Hold connecting departures that are losing the most passengers.
  const riskByFlight = new Map<string, number>();
  for (const m of current.misses) {
    riskByFlight.set(m.toFlightId, (riskByFlight.get(m.toFlightId) ?? 0) + m.pax);
  }
  const holdTargets = [...riskByFlight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [flightId, pax] of holdTargets) {
    const f = byId.get(flightId);
    if (!f) continue;
    const minutes = 30;
    add(
      mk({ type: 'hold', flightId, minutes, note: `Hold ${f.flightNo} for ${pax} connecting pax` }),
      `Hold ${f.flightNo} at ${f.origin} for ${minutes} min`,
      'Delays this aircraft’s remaining chain and its own through-passengers.',
    );
  }

  // 3. Cancel-to-recover: worst delayed, low-load legs.
  const cancelPool = operated
    .filter((f) => outs[f.id].depDelay > 90 && f.pax < 150)
    .sort((a, b) => outs[b.id].depDelay * (180 - b.pax) - outs[a.id].depDelay * (180 - a.pax))
    .slice(0, 3);
  for (const f of cancelPool) {
    add(
      mk({ type: 'cancel', flightId: f.id, note: `Cancel ${f.flightNo} to release the aircraft` }),
      `Cancel ${f.flightNo} (${f.origin}→${f.dest})`,
      `Strands ${fmtNumber(f.pax)} passengers but lets the aircraft reposition downstream.`,
    );
  }

  // 4. Same-station aircraft swaps.
  const delayedPool = operated
    .filter((f) => outs[f.id].depDelay > 30)
    .sort((a, b) => outs[b.id].depDelay - outs[a.id].depDelay)
    .slice(0, 5);
  for (const f of delayedPool) {
    const partner = operated
      .filter((g) => {
        if (g.id === f.id || g.origin !== f.origin) return false;
        const tailF = outs[f.id].tailId;
        const tailG = outs[g.id].tailId;
        if (tailF === tailG) return false;
        if (outs[g.id].arrDelay > 12) return false;
        const acF = acBy.get(tailF);
        if (acF && acF.seats < g.pax) return false;
        return Math.abs(outs[g.id].schedDep - outs[f.id].schedDep) < 200;
      })
      .sort((a, b) => outs[a.id].depDelay - outs[b.id].depDelay)[0];
    if (!partner) continue;
    add(
      mk({
        type: 'swap',
        flightId: f.id,
        otherFlightId: partner.id,
        note: `Swap ${outs[f.id].tailId} ↔ ${outs[partner.id].tailId} at ${f.origin}`,
      }),
      `Swap aircraft: ${f.flightNo} ↔ ${partner.flightNo}`,
      'Both aircraft stay in the network; the on-time one absorbs the critical leg.',
    );
  }

  // 5. Standby aircraft for the worst legs.
  const spares = input.aircraft.filter((a) => a.standby) as Aircraft[];
  if (spares.length) {
    for (const f of delayedPool.slice(0, 3)) {
      const spare = spares.find((s) => (acBy.get(s.tailId)?.seats ?? 0) >= f.pax);
      if (!spare) continue;
      add(
        mk({
          type: 'spare',
          flightId: f.id,
          spareTailId: spare.tailId,
          note: `Deploy ${spare.tailId} to cover ${f.flightNo}`,
        }),
        `Deploy standby ${spare.tailId} on ${f.flightNo}`,
        spare.base !== f.origin
          ? `Ferry from ${spare.base} to ${f.origin} costs time before it can fly.`
          : 'Highest fixed cost lever, but it protects the whole downstream chain.',
      );
      break;
    }
  }

  // 6. Pre-emptive retiming ahead of the storm.
  for (const ev of input.weather.slice(0, 3)) {
    const pool = operated
      .filter((f) => f.origin === ev.airport)
      .filter((f) => f.schedDep >= ev.startTime - 150 && f.schedDep <= ev.startTime - 20)
      .sort((a, b) => outs[b.id].depDelay + outs[b.id].arrDelay - (outs[a.id].depDelay + outs[a.id].arrDelay))
      .slice(0, 2);
    for (const f of pool) {
      add(
        mk({
          type: 'retime',
          flightId: f.id,
          minutes: -30,
          note: `Pull ${f.flightNo} forward 30 min, ahead of the ${ev.airport} closure`,
        }),
        `Retime ${f.flightNo} earlier by 30 min`,
        'Only works if the inbound aircraft and crew are already available.',
      );
    }
  }

  const results: Recommendation[] = [];
  for (const seed of seeds.slice(0, 40)) {
    const next = simulateNetwork({ ...input, actions: [...actions, seed.action] });
    const gain = gainOf(current.metrics, next.metrics);
    if (gain <= 0.5) continue;
    const f = seed.action.flightId ? byId.get(seed.action.flightId) : undefined;
    const deltaDelay = current.metrics.totalDelayMin - next.metrics.totalDelayMin;
    const deltaPax = current.metrics.paxStranded - next.metrics.paxStranded;
    const deltaCost = current.metrics.estimatedCost - next.metrics.estimatedCost;
    const detail =
      `${deltaDelay >= 0 ? 'Saves' : 'Adds'} ${fmtNumber(Math.abs(deltaDelay))} delay-min` +
      ` · ${deltaPax >= 0 ? 'rescues' : 'strands'} ${fmtNumber(Math.abs(deltaPax))} pax` +
      ` · ${deltaCost >= 0 ? 'cuts' : 'adds'} ${fmtMoney(Math.abs(deltaCost))} cost` +
      (f ? ` · ${f.flightNo} ${f.origin}→${f.dest}` : '');
    results.push({
      id: seed.action.id,
      action: seed.action,
      title: seed.title,
      detail,
      risk: seed.risk,
      gain,
      deltaDelay,
      deltaPax,
      deltaCost,
      result: next,
    });
  }

  results.sort((a, b) => b.gain - a.gain);
  void baseline;
  return dedupe(results).slice(0, limit);
}

function dedupe(recs: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of recs) {
    const k = `${r.action.type}:${r.action.flightId ?? ''}:${r.action.otherFlightId ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Greedy auto-optimiser: apply the best action, re-evaluate, repeat while the
 * improvement is meaningful. Each step is returned so the UI can animate it.
 */
export function autoOptimise(
  input: SimInput,
  current: SimResult,
  baseline: SimResult,
  maxSteps = 6,
): { actions: RecoveryAction[]; result: SimResult; steps: Recommendation[] } {
  let actions = [...input.actions];
  let result = current;
  const steps: Recommendation[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const best = buildRecommendations({ ...input, actions }, result, baseline, 1)[0];
    if (!best || best.gain < 25) break;
    actions = [...actions, best.action];
    result = best.result;
    steps.push(best);
  }
  return { actions, result, steps };
}
