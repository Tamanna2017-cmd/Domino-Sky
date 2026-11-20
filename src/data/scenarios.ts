import type { WeatherEvent } from '../engine/types';
import { mulberry32 } from '../engine/util';

export interface ScenarioPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  weather: Omit<WeatherEvent, 'id'>[];
}

const hm = (h: number, m = 0) => h * 60 + m;

export const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'mumbai',
    name: 'Mumbai Monsoon Storm',
    tagline: '90 min closure at BOM, 14:00',
    description:
      'A convective cell shuts Mumbai for 90 minutes. Every aircraft that touches BOM in the early afternoon carries the delay into the evening.',
    accent: '#22d3ee',
    weather: [
      { airport: 'BOM', startTime: hm(14), duration: 90, severity: 3, label: 'Monsoon thunderstorm' },
    ],
  },
  {
    id: 'delhi',
    name: 'Delhi Winter Fog',
    tagline: '3 h ground stop at DEL, 06:00',
    description:
      'Dense radiation fog drops visibility below CAT III minima. Departures are stopped for three hours at the morning peak.',
    accent: '#fbbf24',
    weather: [
      { airport: 'DEL', startTime: hm(6), duration: 180, severity: 2, label: 'Dense winter fog' },
    ],
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru Thunderstorm',
    tagline: '75 min closure at BLR, 16:00',
    description:
      'An evening storm parks over Kempegowda. Arrivals hold and the departure queue spills into the peak bank.',
    accent: '#a78bfa',
    weather: [
      { airport: 'BLR', startTime: hm(16), duration: 75, severity: 3, label: 'Evening thunderstorm' },
    ],
  },
  {
    id: 'multi',
    name: 'Multi-airport Chaos',
    tagline: 'BOM closure + DEL stop + BLR slowdown',
    description:
      'Three simultaneous events: a Mumbai closure, a Delhi ground stop and reduced capacity in Bengaluru. The network has to choose what to protect.',
    accent: '#f87171',
    weather: [
      { airport: 'BOM', startTime: hm(13, 30), duration: 90, severity: 3, label: 'Coastal squall line' },
      { airport: 'DEL', startTime: hm(17), duration: 120, severity: 2, label: 'Dust storm' },
      { airport: 'BLR', startTime: hm(9, 30), duration: 60, severity: 1, label: 'Low ceilings' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Event',
    tagline: 'Click any airport to design your storm',
    description:
      'No weather preloaded. Click an airport on the map, then choose severity and duration to trigger your own disruption.',
    accent: '#94a3b8',
    weather: [],
  },
];

export const getScenario = (id: string): ScenarioPreset =>
  SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

export function scenarioWeather(preset: ScenarioPreset): WeatherEvent[] {
  return preset.weather.map((w, i) => ({ ...w, id: `W-${preset.id}-${i}` }));
}

const CHAOS_AIRPORTS = ['DEL', 'BOM', 'BLR', 'CCU', 'MAA', 'HYD', 'AMD', 'PNQ', 'GOI', 'JAI', 'COK', 'LKO'];

export function randomChaos(seed = Date.now()): WeatherEvent[] {
  const rnd = mulberry32(seed);
  const count = 2 + Math.floor(rnd() * 2);
  const used = new Set<string>();
  const events: WeatherEvent[] = [];
  for (let i = 0; i < count; i++) {
    let airport = CHAOS_AIRPORTS[Math.floor(rnd() * CHAOS_AIRPORTS.length)];
    let guard = 0;
    while (used.has(airport) && guard++ < 12) {
      airport = CHAOS_AIRPORTS[Math.floor(rnd() * CHAOS_AIRPORTS.length)];
    }
    used.add(airport);
    const severity = (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3;
    events.push({
      id: `W-chaos-${seed}-${i}`,
      airport,
      startTime: hm(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 4) * 15),
      duration: 45 + Math.floor(rnd() * 5) * 15,
      severity,
      label: severity === 3 ? 'Severe cell' : severity === 2 ? 'Ground stop' : 'Reduced capacity',
    });
  }
  return events;
}
