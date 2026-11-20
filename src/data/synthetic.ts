import type { Aircraft, Dataset, Flight } from '../engine/types';
import { AIRPORTS, AIRPORT_BY_CODE, AIRPORT_WEIGHT } from './airports';
import { kmBetween, mulberry32 } from '../engine/util';

const CARRIERS = ['AI', '6E', 'UK', 'SG', 'QP'];

const TYPES = [
  { type: 'A320neo', seats: 186 },
  { type: 'A321neo', seats: 222 },
  { type: 'B737-8', seats: 189 },
  { type: 'ATR72-600', seats: 70 },
];

const BASES = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA', 'CCU', 'AMD', 'PNQ', 'GOI', 'COK'];

const tailLetters = (n: number): string => {
  const a = String.fromCharCode(65 + Math.floor(n / 676) % 26);
  const b = String.fromCharCode(65 + Math.floor(n / 26) % 26);
  const c = String.fromCharCode(65 + (n % 26));
  return `VT-${a}${b}${c}`;
};

/** Pick the next destination, deliberately biased towards Mumbai in the middle of the day. */
function pickDest(from: string, t: number, rnd: () => number): string {
  const midday = t >= 11 * 60 && t <= 16 * 60;
  if (from !== 'BOM' && midday && rnd() < 0.42) return 'BOM';
  const options = AIRPORTS.filter((a) => a.code !== from);
  const total = options.reduce((s, a) => s + AIRPORT_WEIGHT[a.code], 0);
  let r = rnd() * total;
  for (const a of options) {
    r -= AIRPORT_WEIGHT[a.code];
    if (r <= 0) return a.code;
  }
  return options[options.length - 1].code;
}

/**
 * Deterministic synthetic day: 25 aircraft, ~148 flights across 12 airports,
 * 6-7 legs per tail, with a passenger connection matrix. The BOM bias around
 * midday makes the "Mumbai Monsoon Storm" preset cascade hard.
 */
export function createSyntheticDataset(seed = 20241119): Dataset {
  const rnd = mulberry32(seed);
  const aircraft: Aircraft[] = [];

  for (let i = 0; i < 23; i++) {
    const t = TYPES[i % TYPES.length];
    aircraft.push({
      tailId: tailLetters(i),
      type: t.type,
      seats: t.seats,
      base: BASES[i % BASES.length],
    });
  }
  aircraft.push({ tailId: 'VT-SBY', type: 'A320neo', seats: 186, base: 'BOM', standby: true });
  aircraft.push({ tailId: 'VT-SBZ', type: 'B737-8', seats: 189, base: 'DEL', standby: true });

  const flights: Flight[] = [];
  let fnum = 101;
  const flying = aircraft.filter((a) => !a.standby);

  flying.forEach((ac, idx) => {
    let pos = ac.base;
    let t = 5 * 60 + Math.floor(rnd() * 95);
    const legs = rnd() < 0.45 ? 7 : 6;
    for (let leg = 0; leg < legs; leg++) {
      const dest = pickDest(pos, t, rnd);
      const from = AIRPORT_BY_CODE.get(pos)!;
      const to = AIRPORT_BY_CODE.get(dest)!;
      const km = kmBetween(from, to);
      const cruise = ac.type.startsWith('ATR') ? 470 : 760;
      const block = Math.max(35, Math.round(((km / cruise) * 60) / 5) * 5 + 20);
      const load = 0.58 + rnd() * 0.36;
      const pax = Math.min(ac.seats, Math.round(ac.seats * load));
      flights.push({
        id: `F${String(flights.length + 1).padStart(3, '0')}`,
        flightNo: `${CARRIERS[idx % CARRIERS.length]} ${fnum++}`,
        tailId: ac.tailId,
        origin: pos,
        dest,
        schedDep: t,
        schedArr: t + block,
        pax,
        connectingPaxMap: {},
      });
      pos = dest;
      t = t + block + 40 + Math.floor(rnd() * 30);
    }
  });

  // Connection matrix: passengers arriving on a flight connect to later departures
  // out of the same airport they landed at.
  const sortedByArrival = [...flights].sort((a, b) => a.schedArr - b.schedArr);
  for (const f of sortedByArrival) {
    const candidates = flights
      .filter(
        (g) =>
          g.origin === f.dest &&
          g.id !== f.id &&
          g.schedDep >= f.schedArr + 40 &&
          g.schedDep <= f.schedArr + 210,
      )
      .sort((a, b) => a.schedDep - b.schedDep);
    if (!candidates.length) continue;
    let remaining = Math.round(f.pax * (0.18 + rnd() * 0.24));
    const take = Math.min(candidates.length, 1 + Math.floor(rnd() * 3));
    for (const g of candidates.slice(0, take)) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, Math.round(f.pax * 0.08 + rnd() * (f.pax * 0.1)));
      if (qty <= 0) continue;
      f.connectingPaxMap[g.id] = (f.connectingPaxMap[g.id] ?? 0) + qty;
      remaining -= qty;
    }
  }

  return {
    airports: AIRPORTS,
    aircraft,
    flights,
    label: 'Synthetic network · 12 airports · 25 tails',
  };
}

export const SYNTHETIC_DATASET = createSyntheticDataset();
