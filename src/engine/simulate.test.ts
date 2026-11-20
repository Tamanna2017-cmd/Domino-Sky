import { describe, expect, it } from 'vitest';
import type {
  Aircraft,
  Airport,
  Flight,
  RecoveryAction,
  SimInput,
  WeatherEvent,
} from './types';
import { DEFAULT_SETTINGS } from './config';
import { simulateNetwork } from './simulate';
import { createSyntheticDataset } from '../data/synthetic';

const hm = (h: number, m = 0) => h * 60 + m;

const AIRPORTS: Airport[] = [
  { code: 'AAA', name: 'Alpha', city: 'Alpha', lat: 10, lon: 70, hourlyCapacity: 60 },
  { code: 'BBB', name: 'Beta', city: 'Beta', lat: 12, lon: 72, hourlyCapacity: 60 },
  { code: 'CCC', name: 'Gamma', city: 'Gamma', lat: 14, lon: 74, hourlyCapacity: 60 },
];

const fl = (over: Partial<Flight> & { id: string }): Flight => ({
  flightNo: over.id,
  tailId: 'T1',
  origin: 'AAA',
  dest: 'BBB',
  schedDep: hm(8),
  schedArr: hm(9),
  pax: 100,
  connectingPaxMap: {},
  ...over,
});

const make = (
  flights: Flight[],
  opts: {
    weather?: WeatherEvent[];
    actions?: RecoveryAction[];
    aircraft?: Aircraft[];
    airports?: Airport[];
    settings?: Partial<typeof DEFAULT_SETTINGS>;
  } = {},
): SimInput => ({
  airports: opts.airports ?? AIRPORTS,
  aircraft: opts.aircraft ?? [{ tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' }],
  flights,
  weather: opts.weather ?? [],
  actions: opts.actions ?? [],
  settings: { ...DEFAULT_SETTINGS, ...opts.settings },
});

const ev = (over: Partial<WeatherEvent>): WeatherEvent => ({
  id: 'W1',
  airport: 'AAA',
  startTime: hm(8),
  duration: 60,
  severity: 3,
  ...over,
});

describe('aircraft turnaround propagation', () => {
  it('delays the next leg of the same tail by arrival + turnaround', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9) });
    const f2 = fl({
      id: 'F2',
      tailId: 'T1',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(9, 30),
      schedArr: hm(10, 30),
    });
    const r = simulateNetwork(
      make([f1, f2], {
        weather: [ev({ startTime: hm(8), duration: 30 })],
      }),
    );
    expect(r.outcomes.F1.actualDep).toBe(hm(8, 30));
    expect(r.outcomes.F1.actualArr).toBe(hm(9, 30));
    // 09:30 arrival + 40 min turnaround = 10:10.
    expect(r.outcomes.F2.actualDep).toBe(hm(10, 10));
    expect(r.outcomes.F2.depDelay).toBe(40);
    expect(r.outcomes.F2.cause).toBe('PROPAGATED');
    expect(r.outcomes.F2.parentFlightId).toBe('F1');
  });

  it('keeps a chain on time when turnaround is sufficient', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9) });
    const f2 = fl({
      id: 'F2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(9, 50),
      schedArr: hm(10, 50),
    });
    const r = simulateNetwork(make([f1, f2]));
    expect(r.outcomes.F2.depDelay).toBe(0);
    expect(r.metrics.flightsAffected).toBe(0);
    expect(r.metrics.onTimePct).toBe(100);
  });
});

describe('weather rules', () => {
  it('holds departures until a severity-3 closure ends', () => {
    const f1 = fl({ id: 'F1' });
    const r = simulateNetwork(make([f1], { weather: [ev({ duration: 90 })] }));
    expect(r.outcomes.F1.actualDep).toBe(hm(9, 30));
    expect(r.outcomes.F1.depDelay).toBe(90);
    expect(r.outcomes.F1.cause).toBe('ROOT_WEATHER');
    expect(r.metrics.directDelayMin).toBeGreaterThan(0);
  });

  it('holds arrivals outside a closed destination', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9, 30) });
    const r = simulateNetwork(
      make([f1], { weather: [ev({ airport: 'BBB', startTime: hm(9), duration: 60 })] }),
    );
    expect(r.outcomes.F1.actualDep).toBe(hm(8));
    expect(r.outcomes.F1.actualArr).toBe(hm(10, 5)); // closure end + 5 min
    expect(r.outcomes.F1.status).toBe('DELAYED');
  });

  it('stops departures under a severity-2 ground stop, then resumes', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9) });
    const f2 = fl({ id: 'F2', tailId: 'T2', schedDep: hm(9, 30), schedArr: hm(10, 30) });
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T2', type: 'A320', seats: 180, base: 'AAA' },
        ],
        weather: [ev({ severity: 2, duration: 40 })],
      }),
    );
    expect(r.outcomes.F1.actualDep).toBe(hm(8, 40));
    expect(r.outcomes.F2.actualDep).toBe(hm(9, 30)); // schedule wins after reopening
  });

  it('halves accepted departures at severity 1', () => {
    const flights = [
      fl({ id: 'F1', schedDep: hm(8) }),
      fl({ id: 'F2', schedDep: hm(8), tailId: 'T2' }),
      fl({ id: 'F3', schedDep: hm(8), tailId: 'T3' }),
    ];
    const r = simulateNetwork(
      make(flights, {
        airports: [{ ...AIRPORTS[0], hourlyCapacity: 4 }, ...AIRPORTS.slice(1)],
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T2', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T3', type: 'A320', seats: 180, base: 'AAA' },
        ],
        weather: [ev({ severity: 1, duration: 60 })],
      }),
    );
    const deps = ['F1', 'F2', 'F3'].map((id) => r.outcomes[id].actualDep!);
    expect(deps.filter((d) => d === hm(8)).length).toBe(2);
    expect(Math.max(...deps)).toBeGreaterThan(hm(8));
  });

  it('diverts arrivals when the event allows it', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9) });
    const r = simulateNetwork(
      make([f1], {
        weather: [ev({ airport: 'BBB', startTime: hm(8, 30), duration: 60, diversions: true })],
      }),
    );
    expect(r.outcomes.F1.status).toBe('DIVERTED');
    expect(r.outcomes.F1.alternate).toBe('AAA');
    expect(r.metrics.flightsDiverted).toBe(1);
  });
});

describe('airport capacity', () => {
  it('queues departures above the hourly capacity', () => {
    const flights = [
      fl({ id: 'F1', schedDep: hm(8) }),
      fl({ id: 'F2', schedDep: hm(8), tailId: 'T2' }),
      fl({ id: 'F3', schedDep: hm(8), tailId: 'T3' }),
    ];
    const r = simulateNetwork(
      make(flights, {
        airports: [{ ...AIRPORTS[0], hourlyCapacity: 2 }, ...AIRPORTS.slice(1)],
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T2', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T3', type: 'A320', seats: 180, base: 'AAA' },
        ],
      }),
    );
    const deps = ['F1', 'F2', 'F3'].map((id) => r.outcomes[id].actualDep!);
    expect(deps.filter((d) => d === hm(8)).length).toBe(2);
    expect(deps.filter((d) => d === hm(9)).length).toBe(1);
  });
});

describe('cancellation rule', () => {
  it('cancels a flight delayed beyond the threshold and ferries the aircraft', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(9) });
    const f2 = fl({
      id: 'F2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(14),
      schedArr: hm(15),
    });
    const r = simulateNetwork(
      make([f1, f2], { weather: [ev({ startTime: hm(8), duration: 300 })] }),
    );
    expect(r.outcomes.F1.status).toBe('CANCELLED');
    expect(r.metrics.flightsCancelled).toBe(1);
    expect(r.outcomes.F2.status).not.toBe('CANCELLED');
    expect(r.outcomes.F2.ferryMinutes).toBeGreaterThan(0);
  });

  it('honours an explicit cancel action', () => {
    const f1 = fl({ id: 'F1' });
    const r = simulateNetwork(
      make([f1], {
        actions: [{ id: 'a1', type: 'cancel', flightId: 'F1', createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F1.status).toBe('CANCELLED');
    expect(r.metrics.paxOnCancelled).toBe(100);
  });
});

describe('connections', () => {
  it('misses a tight connection and reports stranded passengers', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(10), pax: 150 });
    const f2 = fl({
      id: 'F2',
      tailId: 'T2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(10, 30),
      schedArr: hm(11, 30),
      pax: 120,
      connectingPaxMap: {},
    });
    f1.connectingPaxMap = { F2: 80 };
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T2', type: 'A320', seats: 180, base: 'BBB' },
        ],
      }),
    );
    expect(r.misses.length).toBe(1);
    expect(r.misses[0].pax).toBe(80);
    expect(r.metrics.paxMisconnected).toBe(80);
    expect(r.metrics.paxStranded).toBe(80);
  });

  it('saves the connection when the departure is held', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(10), pax: 150 });
    const f2 = fl({
      id: 'F2',
      tailId: 'T2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(10, 30),
      schedArr: hm(11, 30),
      pax: 120,
    });
    f1.connectingPaxMap = { F2: 80 };
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'T2', type: 'A320', seats: 180, base: 'BBB' },
        ],
        actions: [{ id: 'h1', type: 'hold', flightId: 'F2', minutes: 30, createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F2.actualDep).toBe(hm(10, 45));
    expect(r.outcomes.F2.heldMinutes).toBe(15);
    expect(r.misses.length).toBe(0);
    expect(r.savedConnections.length).toBe(1);
    expect(r.metrics.paxMisconnected).toBe(0);
  });
});

describe('recovery actions', () => {
  const twoTails: Aircraft[] = [
    { tailId: 'T1', type: 'A320', seats: 100, base: 'AAA' },
    { tailId: 'T2', type: 'A320', seats: 200, base: 'AAA' },
  ];

  it('exchanges tails on a valid swap', () => {
    const f1 = fl({ id: 'F1', tailId: 'T1', schedDep: hm(10), pax: 80, dest: 'BBB' });
    const f2 = fl({ id: 'F2', tailId: 'T2', schedDep: hm(10, 10), pax: 90, dest: 'CCC' });
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: twoTails,
        actions: [{ id: 's1', type: 'swap', flightId: 'F1', otherFlightId: 'F2', createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F1.tailId).toBe('T2');
    expect(r.outcomes.F2.tailId).toBe('T1');
  });

  it('rejects a swap when the aircraft is too small', () => {
    const f1 = fl({ id: 'F1', tailId: 'T1', schedDep: hm(10), pax: 80 });
    const f2 = fl({ id: 'F2', tailId: 'T2', schedDep: hm(10, 10), pax: 150, dest: 'CCC' });
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: twoTails,
        actions: [{ id: 's1', type: 'swap', flightId: 'F1', otherFlightId: 'F2', createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F1.tailId).toBe('T1');
    expect(r.outcomes.F2.tailId).toBe('T2');
  });

  it('rejects a swap between different airports', () => {
    const f1 = fl({ id: 'F1', tailId: 'T1', schedDep: hm(10), pax: 80 });
    const f2 = fl({
      id: 'F2',
      tailId: 'T2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(10, 10),
      pax: 90,
    });
    const r = simulateNetwork(
      make([f1, f2], {
        aircraft: twoTails,
        actions: [{ id: 's1', type: 'swap', flightId: 'F1', otherFlightId: 'F2', createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F1.tailId).toBe('T1');
  });

  it('deploys a standby aircraft and frees the original tail', () => {
    const f1 = fl({ id: 'F1', tailId: 'T1', schedDep: hm(8), schedArr: hm(9), pax: 120 });
    const r = simulateNetwork(
      make([f1], {
        aircraft: [
          { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
          { tailId: 'SBY', type: 'A320', seats: 200, base: 'AAA', standby: true },
        ],
        weather: [ev({ duration: 120 })],
        actions: [{ id: 'sp1', type: 'spare', flightId: 'F1', spareTailId: 'SBY', createdAt: 0 }],
      }),
    );
    expect(r.outcomes.F1.tailId).toBe('SBY');
    expect(r.outcomes.F1.actualDep).toBe(hm(10));
  });

  it('rebooks stranded passengers using spare seats', () => {
    const f1 = fl({ id: 'F1', schedDep: hm(8), schedArr: hm(10), pax: 150 });
    const f2 = fl({
      id: 'F2',
      tailId: 'T2',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(10, 30),
      schedArr: hm(11, 30),
      pax: 100, // 80 spare seats
    });
    const f3 = fl({
      id: 'F3',
      tailId: 'T3',
      origin: 'BBB',
      dest: 'CCC',
      schedDep: hm(12),
      schedArr: hm(13),
      pax: 50,
    });
    f1.connectingPaxMap = { F2: 120 };
    const base = make([f1, f2, f3], {
      aircraft: [
        { tailId: 'T1', type: 'A320', seats: 180, base: 'AAA' },
        { tailId: 'T2', type: 'A320', seats: 180, base: 'BBB' },
        { tailId: 'T3', type: 'A320', seats: 180, base: 'BBB' },
      ],
    });
    const r = simulateNetwork({
      ...base,
      actions: [{ id: 'rb', type: 'rebook', createdAt: 0 }],
    });
    expect(r.metrics.paxMisconnected).toBe(120);
    expect(r.metrics.paxRebooked).toBe(120);
    expect(r.metrics.paxStranded).toBe(0);
  });
});

describe('metrics and determinism', () => {
  const dataset = createSyntheticDataset();
  const storm: WeatherEvent[] = [
    { id: 'W', airport: 'BOM', startTime: hm(14), duration: 90, severity: 3 },
  ];

  it('builds the promised synthetic network', () => {
    expect(dataset.airports.length).toBeGreaterThanOrEqual(12);
    expect(dataset.aircraft.length).toBe(25);
    expect(dataset.flights.length).toBeGreaterThanOrEqual(140);
    const chains = new Map<string, number>();
    for (const f of dataset.flights) chains.set(f.tailId, (chains.get(f.tailId) ?? 0) + 1);
    expect(Math.max(...chains.values())).toBeLessThanOrEqual(7);
  });

  it('produces a deep cascade for the Mumbai storm preset', () => {
    const r = simulateNetwork({
      airports: dataset.airports,
      aircraft: dataset.aircraft,
      flights: dataset.flights,
      weather: storm,
      actions: [],
      settings: DEFAULT_SETTINGS,
    });
    expect(r.metrics.flightsAffected).toBeGreaterThan(10);
    expect(r.metrics.maxCascadeDepth).toBeGreaterThanOrEqual(2);
    expect(r.metrics.totalDelayMin).toBeGreaterThan(500);
    expect(r.metrics.amplificationFactor).toBeGreaterThan(1);
    expect(r.metrics.paxMisconnected).toBeGreaterThan(0);
    expect(r.metrics.onTimePct).toBeLessThan(100);
  });

  it('is deterministic across runs', () => {
    const run = () =>
      simulateNetwork({
        airports: dataset.airports,
        aircraft: dataset.aircraft,
        flights: dataset.flights,
        weather: storm,
        actions: [],
        settings: DEFAULT_SETTINGS,
      });
    const a = run();
    const b = run();
    expect(a.metrics).toEqual(b.metrics);
    expect(a.outcomes).toEqual(b.outcomes);
  });

  it('stays well under the 100 ms budget for the full day network', () => {
    const input: SimInput = {
      airports: dataset.airports,
      aircraft: dataset.aircraft,
      flights: dataset.flights,
      weather: storm,
      actions: [],
      settings: DEFAULT_SETTINGS,
    };
    simulateNetwork(input);
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) simulateNetwork(input);
    const avg = (Date.now() - t0) / 5;
    expect(avg).toBeLessThan(100);
  });
});
