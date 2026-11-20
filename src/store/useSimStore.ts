import { create } from 'zustand';
import type {
  Dataset,
  RecoveryAction,
  SimResult,
  SimSettings,
  WeatherEvent,
} from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/config';
import { simulateNetwork } from '../engine/simulate';
import { OFFICIAL_DATASET } from '../data/officialDataset';
import { getScenario, randomChaos, scenarioWeather, SCENARIOS } from '../data/scenarios';
import { uid } from '../engine/util';

export interface ToastMsg {
  id: string;
  text: string;
  tone: 'info' | 'good' | 'warn' | 'danger';
}

type Patch = Omit<RecoveryAction, 'id' | 'createdAt'> & { id?: string };

const simulateAll = (
  dataset: Dataset,
  weather: WeatherEvent[],
  actions: RecoveryAction[],
  settings: SimSettings,
): { sim: SimResult; baseline: SimResult } => {
  const base = {
    airports: dataset.airports,
    aircraft: dataset.aircraft,
    flights: dataset.flights,
    weather,
    settings,
  };
  return {
    sim: simulateNetwork({ ...base, actions }),
    baseline: simulateNetwork({ ...base, actions: [] }),
  };
};

const dayEndFor = (sim: SimResult): number => {
  let max = 1440;
  for (const o of Object.values(sim.outcomes)) {
    const t = o.actualArr ?? o.schedArr;
    if (t > max) max = t;
  }
  return Math.min(1620, Math.ceil(max / 15) * 15);
};

const pushToast = (list: ToastMsg[], text: string, tone: ToastMsg['tone']): ToastMsg[] => {
  const next = [...list, { id: uid('t'), text, tone }];
  return next.slice(-4);
};

const initialScenario = SCENARIOS[0];
const initialWeather = scenarioWeather(initialScenario);
const initial = simulateAll(OFFICIAL_DATASET, initialWeather, [], DEFAULT_SETTINGS);

const actionLabel = (a: RecoveryAction): string => {
  switch (a.type) {
    case 'swap':
      return 'Aircraft swap applied';
    case 'cancel':
      return 'Flight cancelled to recover the chain';
    case 'hold':
      return `Connection held for ${a.minutes ?? 0} min`;
    case 'spare':
      return `Standby ${a.spareTailId ?? ''} deployed`;
    case 'retime':
      return `Departure retimed ${a.minutes ?? 0} min`;
    case 'rebook':
      return 'Passenger rebooking enabled';
  }
};

export interface SimStore {
  dataset: Dataset;
  scenarioId: string;
  weather: WeatherEvent[];
  actions: RecoveryAction[];
  past: RecoveryAction[][];
  future: RecoveryAction[][];
  settings: SimSettings;
  sim: SimResult;
  baseline: SimResult;
  clock: number;
  playing: boolean;
  speed: number;
  dayEnd: number;
  view: 'map' | 'timeline' | 'network';
  showArcs: boolean;
  selectedFlightId: string | null;
  selectedAirport: string | null;
  showIntro: boolean;
  showHow: boolean;
  showLoad: boolean;
  showSettings: boolean;
  showReport: boolean;
  tourStep: number;
  toasts: ToastMsg[];
  lastDecision: string | null;

  loadScenario: (id: string) => void;
  loadDataset: (dataset: Dataset) => void;
  addWeather: (ev: WeatherEvent) => void;
  removeWeather: (id: string) => void;
  clearWeather: () => void;
  randomise: () => void;
  applyAction: (patch: Patch, label?: string) => void;
  undo: () => void;
  redo: () => void;
  resetActions: () => void;
  setSettings: (patch: Partial<SimSettings>) => void;

  setClock: (t: number) => void;
  advance: (realSeconds: number) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;

  setView: (v: 'map' | 'timeline' | 'network') => void;
  toggleArcs: () => void;
  selectFlight: (id: string | null) => void;
  selectAirport: (code: string | null) => void;

  setShow: (
    key: 'showIntro' | 'showHow' | 'showLoad' | 'showSettings' | 'showReport',
    value: boolean,
  ) => void;
  setTourStep: (n: number) => void;
  toast: (text: string, tone?: ToastMsg['tone']) => void;
  dismissToast: (id: string) => void;
}

export const useSimStore = create<SimStore>()((set, get) => ({
  dataset: OFFICIAL_DATASET,
  scenarioId: initialScenario.id,
  weather: initialWeather,
  actions: [],
  past: [],
  future: [],
  settings: DEFAULT_SETTINGS,
  sim: initial.sim,
  baseline: initial.baseline,
  clock: Math.max(300, initialScenario.weather[0].startTime - 20),
  playing: false,
  speed: 5,
  dayEnd: dayEndFor(initial.sim),
  view: 'map',
  showArcs: true,
  selectedFlightId: null,
  selectedAirport: null,
  showIntro: true,
  showHow: false,
  showLoad: false,
  showSettings: false,
  showReport: false,
  tourStep: 0,
  toasts: [],
  lastDecision: null,

  loadScenario: (id) => {
    const s = get();
    const preset = getScenario(id);
    const weather = scenarioWeather(preset);
    const { sim, baseline } = simulateAll(s.dataset, weather, [], s.settings);
    const first = weather[0];
    set({
      scenarioId: preset.id,
      weather,
      actions: [],
      past: [],
      future: [],
      sim,
      baseline,
      dayEnd: dayEndFor(sim),
      clock: first ? Math.max(240, first.startTime - 20) : 300,
      playing: false,
      selectedFlightId: null,
      selectedAirport: null,
      lastDecision: null,
      toasts: pushToast(s.toasts, `${preset.name} loaded`, 'info'),
    });
  },

  loadDataset: (dataset) => {
    const s = get();
    const { sim, baseline } = simulateAll(dataset, [], [], s.settings);
    set({
      dataset,
      weather: [],
      actions: [],
      past: [],
      future: [],
      sim,
      baseline,
      scenarioId: 'custom',
      clock: 300,
      playing: false,
      dayEnd: dayEndFor(sim),
      selectedFlightId: null,
      selectedAirport: null,
      tourStep: 0,
      toasts: pushToast(s.toasts, `Loaded ${dataset.label}`, 'good'),
    });
  },

  addWeather: (ev) => {
    const s = get();
    const weather = [...s.weather.filter((w) => w.id !== ev.id), ev];
    const { sim, baseline } = simulateAll(s.dataset, weather, s.actions, s.settings);
    set({
      weather,
      sim,
      baseline,
      dayEnd: dayEndFor(sim),
      clock: Math.max(240, Math.min(s.clock, ev.startTime - 20)),
      playing: false,
      toasts: pushToast(
        s.toasts,
        `${ev.airport} ${ev.severity === 3 ? 'closed' : ev.severity === 2 ? 'ground stop' : 'capacity cut'} for ${ev.duration} min`,
        'danger',
      ),
    });
  },

  removeWeather: (id) => {
    const s = get();
    const weather = s.weather.filter((w) => w.id !== id);
    const { sim, baseline } = simulateAll(s.dataset, weather, s.actions, s.settings);
    set({ weather, sim, baseline, dayEnd: dayEndFor(sim) });
  },

  clearWeather: () => {
    const s = get();
    const { sim, baseline } = simulateAll(s.dataset, [], [], s.settings);
    set({
      weather: [],
      actions: [],
      past: [],
      future: [],
      sim,
      baseline,
      scenarioId: 'custom',
      clock: 300,
      playing: false,
      dayEnd: dayEndFor(sim),
      lastDecision: null,
    });
  },

  randomise: () => {
    const s = get();
    const weather = randomChaos();
    const { sim, baseline } = simulateAll(s.dataset, weather, [], s.settings);
    const first = [...weather].sort((a, b) => a.startTime - b.startTime)[0];
    set({
      weather,
      actions: [],
      past: [],
      future: [],
      sim,
      baseline,
      scenarioId: 'custom',
      clock: Math.max(240, first.startTime - 20),
      playing: false,
      dayEnd: dayEndFor(sim),
      selectedFlightId: null,
      toasts: pushToast(
        s.toasts,
        `Random chaos: ${weather.map((w) => w.airport).join(' · ')}`,
        'warn',
      ),
    });
  },

  applyAction: (patch, label) => {
    const s = get();
    const action: RecoveryAction = {
      ...patch,
      id: patch.id ?? uid('act'),
      createdAt: Date.now(),
    };
    const actions = [...s.actions, action];
    const { sim } = simulateAll(s.dataset, s.weather, actions, s.settings);
    set({
      actions,
      past: [...s.past, s.actions],
      future: [],
      sim,
      dayEnd: dayEndFor(sim),
      lastDecision: label ?? actionLabel(action),
      toasts: pushToast(s.toasts, label ?? actionLabel(action), 'good'),
    });
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    const { sim } = simulateAll(s.dataset, s.weather, prev, s.settings);
    set({
      actions: prev,
      past: s.past.slice(0, -1),
      future: [s.actions, ...s.future],
      sim,
      dayEnd: dayEndFor(sim),
      toasts: pushToast(s.toasts, 'Decision undone', 'info'),
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    const { sim } = simulateAll(s.dataset, s.weather, next, s.settings);
    set({
      actions: next,
      past: [...s.past, s.actions],
      future: s.future.slice(1),
      sim,
      dayEnd: dayEndFor(sim),
      toasts: pushToast(s.toasts, 'Decision reapplied', 'info'),
    });
  },

  resetActions: () => {
    const s = get();
    if (!s.actions.length) return;
    const { sim } = simulateAll(s.dataset, s.weather, [], s.settings);
    set({
      actions: [],
      past: [...s.past, s.actions],
      future: [],
      sim,
      dayEnd: dayEndFor(sim),
      lastDecision: null,
      selectedFlightId: null,
      toasts: pushToast(s.toasts, 'All recovery actions cleared', 'info'),
    });
  },

  setSettings: (patch) => {
    const s = get();
    const settings = { ...s.settings, ...patch };
    const { sim, baseline } = simulateAll(s.dataset, s.weather, s.actions, settings);
    set({ settings, sim, baseline, dayEnd: dayEndFor(sim) });
  },

  setClock: (t) => set({ clock: Math.max(240, Math.min(get().dayEnd, t)) }),

  advance: (realSeconds) => {
    const s = get();
    if (!s.playing) return;
    const next = s.clock + realSeconds * s.speed * 4;
    if (next >= s.dayEnd) set({ clock: s.dayEnd, playing: false });
    else set({ clock: next });
  },

  togglePlay: () => {
    const s = get();
    if (!s.playing && s.clock >= s.dayEnd) set({ clock: 240, playing: true });
    else set({ playing: !s.playing });
  },

  setSpeed: (speed) => set({ speed }),

  setView: (view) => set({ view }),
  toggleArcs: () => set((s) => ({ showArcs: !s.showArcs })),
  selectFlight: (selectedFlightId) => set({ selectedFlightId }),
  selectAirport: (selectedAirport) => set({ selectedAirport }),

  setShow: (key, value) => set({ [key]: value } as Partial<SimStore>),
  setTourStep: (tourStep) => set({ tourStep }),

  toast: (text, tone = 'info') => set((s) => ({ toasts: pushToast(s.toasts, text, tone) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
