import type { Aircraft, Airport, Dataset, Flight } from '../engine/types';
import { AIRPORT_BY_CODE, AIRPORTS } from './airports';

export type MappingKey =
  | 'flightNo'
  | 'tailId'
  | 'origin'
  | 'dest'
  | 'schedDep'
  | 'schedArr'
  | 'pax'
  | 'seats';

export interface MappingField {
  key: MappingKey;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const MAPPING_FIELDS: MappingField[] = [
  { key: 'flightNo', label: 'Flight number', required: true, synonyms: ['flight', 'flight_no', 'flightno', 'flight number', 'flt', 'number', 'flightnum'] },
  { key: 'tailId', label: 'Aircraft / tail', required: true, synonyms: ['tail', 'tail_id', 'tailid', 'aircraft', 'registration', 'reg', 'equipment', 'ac'] },
  { key: 'origin', label: 'Origin', required: true, synonyms: ['origin', 'from', 'dep', 'departure', 'origin_airport', 'src', 'from_airport'] },
  { key: 'dest', label: 'Destination', required: true, synonyms: ['dest', 'destination', 'to', 'arr', 'arrival', 'dest_airport', 'to_airport'] },
  { key: 'schedDep', label: 'Scheduled departure', required: true, synonyms: ['sched_dep', 'std', 'dep_time', 'departure_time', 'scheduled_departure', 'departure', 'etd'] },
  { key: 'schedArr', label: 'Scheduled arrival', required: true, synonyms: ['sched_arr', 'sta', 'arr_time', 'arrival_time', 'scheduled_arrival', 'arrival', 'eta'] },
  { key: 'pax', label: 'Passengers', required: false, synonyms: ['pax', 'passengers', 'pax_count', 'load', 'booked'] },
  { key: 'seats', label: 'Aircraft seats (optional)', required: false, synonyms: ['seats', 'capacity', 'seat_count'] },
];

export type Row = Record<string, string | number>;

export interface ParsedTable {
  rows: Row[];
  columns: string[];
  source: 'csv' | 'json';
  error?: string;
}

const splitCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
};

const toNumber = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

/** "14:05", "1405", "2:05 PM", "840" (minutes since midnight) all accepted. */
export function parseTimeOfDay(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v <= 24 ? Math.round(v * 60) : Math.round(v);
  }
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  const ampm = /(am|pm)/i.exec(raw);
  const nums = raw.match(/(\d{1,2}):?(\d{2})?/);
  if (!nums) return null;
  let h = parseInt(nums[1], 10);
  const m = nums[2] ? parseInt(nums[2], 10) : 0;
  if (ampm) {
    const pm = /pm/i.test(ampm[1]);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59 || h > 24) return null;
  return h * 60 + m;
}

export function parseTable(text: string, filename: string): ParsedTable {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], columns: [], source: 'csv', error: 'The file is empty.' };
  const isJson = filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!isJson) {
    const cells = splitCsv(trimmed);
    if (!cells.length) return { rows: [], columns: [], source: 'csv', error: 'No CSV rows found.' };
    const header = cells[0].map((h) => h.trim());
    const rows = cells.slice(1).map((r) => {
      const obj: Row = {};
      header.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim();
      });
      return obj;
    });
    return { rows, columns: header, source: 'csv' };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    let list: unknown = parsed;
    if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      list = obj.flights ?? obj.data ?? obj.rows ?? obj.records ?? null;
      if (list == null && Array.isArray(obj.aircraft)) list = obj.aircraft;
    }
    if (!Array.isArray(list)) {
      return { rows: [], columns: [], source: 'json', error: 'JSON must be an array of flight objects.' };
    }
    const rows = list.filter((r): r is Row => !!r && typeof r === 'object') as Row[];
    if (!rows.length) return { rows: [], columns: [], source: 'json', error: 'JSON array is empty.' };
    const columns: string[] = [];
    for (const r of rows.slice(0, 60)) {
      for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
    }
    return { rows, columns, source: 'json' };
  } catch {
    return { rows: [], columns: [], source: 'json', error: 'Could not parse JSON — check the file syntax.' };
  }
}

export function autoMap(columns: string[]): Partial<Record<MappingKey, string>> {
  const mapping: Partial<Record<MappingKey, string>> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const field of MAPPING_FIELDS) {
    const hit = columns.find((c) => {
      const n = norm(c);
      return field.synonyms.some((s) => norm(s) === n) || n === norm(field.key) || n.includes(norm(field.key));
    });
    if (hit) mapping[field.key] = hit;
  }
  return mapping;
}

export interface BuildResult {
  dataset?: Dataset;
  errors: string[];
  warnings: string[];
}

export function buildDataset(
  rows: Row[],
  mapping: Partial<Record<MappingKey, string>>,
  label: string,
): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing = MAPPING_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  if (missing.length) {
    errors.push(`Map these required columns first: ${missing.join(', ')}.`);
    return { errors, warnings };
  }
  if (!rows.length) {
    errors.push('The table has no data rows.');
    return { errors, warnings };
  }

  const cell = (r: Row, key: MappingKey): string => {
    const col = mapping[key];
    return col ? String(r[col] ?? '').trim() : '';
  };

  const flights: Flight[] = [];
  const unknownAirports = new Set<string>();
  const seen = new Set<string>();

  rows.forEach((r, index) => {
    const origin = cell(r, 'origin').toUpperCase();
    const dest = cell(r, 'dest').toUpperCase();
    if (!origin || !dest) {
      errors.push(`Row ${index + 2}: origin and destination are required.`);
      return;
    }
    if (!AIRPORT_BY_CODE.has(origin)) unknownAirports.add(origin);
    if (!AIRPORT_BY_CODE.has(dest)) unknownAirports.add(dest);
    const dep = parseTimeOfDay(mapping.schedDep ? r[mapping.schedDep] : '');
    const arr = parseTimeOfDay(mapping.schedArr ? r[mapping.schedArr] : '');
    if (dep == null || arr == null) {
      errors.push(`Row ${index + 2}: could not read departure/arrival time.`);
      return;
    }
    const tailId = cell(r, 'tailId') || `TAIL-${index + 1}`;
    const flightNo = cell(r, 'flightNo') || `FLT${index + 1}`;
    let id = `F${index + 1}`;
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const block = arr > dep ? arr - dep : arr + 1440 - dep;
    if (block < 20) warnings.push(`${flightNo}: block time is only ${block} min — check the times.`);
    flights.push({
      id,
      flightNo,
      tailId,
      origin,
      dest,
      schedDep: dep,
      schedArr: dep + block,
      pax: Math.max(0, Math.round(toNumber(mapping.pax ? r[mapping.pax] : 0, 120))),
      connectingPaxMap: {},
    });
  });

  if (unknownAirports.size) {
    errors.push(
      `Unknown airport code(s): ${[...unknownAirports].slice(0, 8).join(', ')}. Supported: ${AIRPORTS.map((a) => a.code).join(', ')}.`,
    );
  }
  if (!flights.length) {
    errors.push('No valid flights could be built from this file.');
    return { errors, warnings };
  }
  if (errors.length) return { errors, warnings };

  flights.sort((a, b) => a.schedDep - b.schedDep);

  // Aircraft are derived from the tails present in the file.
  const aircraftMap = new Map<string, Aircraft>();
  rows.forEach((r, i) => {
    const tailId = cell(r, 'tailId') || `TAIL-${i + 1}`;
    const seats = Math.max(40, Math.round(toNumber(mapping.seats ? r[mapping.seats] : 0, 180)));
    const existing = aircraftMap.get(tailId);
    if (existing) existing.seats = Math.max(existing.seats, seats);
    else
      aircraftMap.set(tailId, {
        tailId,
        type: 'Mapped fleet',
        seats,
        base: cell(r, 'origin').toUpperCase() || flights[0].origin,
      });
  });

  // Infer a connection matrix when the file has none.
  let inferred = 0;
  for (const f of flights) {
    const candidates = flights
      .filter(
        (g) => g.origin === f.dest && g.id !== f.id && g.schedDep >= f.schedArr + 40 && g.schedDep <= f.schedArr + 180,
      )
      .slice(0, 2);
    if (!candidates.length) continue;
    let remaining = Math.round(f.pax * 0.2);
    for (const g of candidates) {
      const qty = Math.min(remaining, Math.round(f.pax * 0.1));
      if (qty <= 0) break;
      f.connectingPaxMap[g.id] = qty;
      remaining -= qty;
      inferred += qty;
    }
  }
  if (inferred > 0) {
    warnings.push(
      'No connection matrix in the file — connections were inferred from same-airport, 40-180 min layovers.',
    );
  }

  const origins = new Map<string, number>();
  for (const f of flights) origins.set(f.origin, (origins.get(f.origin) ?? 0) + 1);
  const airportList: Airport[] = AIRPORTS.filter((a) => origins.has(a.code));

  // Chain continuity check.
  let brokenChains = 0;
  const byTail = new Map<string, Flight[]>();
  for (const f of flights) {
    const list = byTail.get(f.tailId) ?? [];
    list.push(f);
    byTail.set(f.tailId, list);
  }
  for (const list of byTail.values()) {
    list.sort((a, b) => a.schedDep - b.schedDep);
    for (let i = 1; i < list.length; i++) {
      if (list[i].origin !== list[i - 1].dest) brokenChains++;
    }
  }
  if (brokenChains > 0) {
    warnings.push(
      `${brokenChains} chain gap(s) detected — the aircraft will be ferried (great-circle estimate) to reposition.`,
    );
  }

  return {
    dataset: {
      airports: airportList,
      aircraft: [...aircraftMap.values()],
      flights,
      label,
    },
    errors,
    warnings,
  };
}

export function toCsv(dataset: Dataset): string {
  const header = 'flight_no,tail,origin,dest,sched_dep,sched_arr,pax';
  const lines = dataset.flights.map((f) => {
    const hm = (m: number) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return [f.flightNo, f.tailId, f.origin, f.dest, hm(f.schedDep), hm(f.schedArr), f.pax].join(',');
  });
  return [header, ...lines].join('\n');
}

export const SAMPLE_CSV = `flight_no,tail,origin,dest,sched_dep,sched_arr,pax
AI 501,VT-ABC,DEL,BOM,08:00,10:05,168
AI 501,VT-ABC,BOM,BLR,10:45,12:20,174
6E 204,VT-DEF,BLR,BOM,13:10,14:45,182
6E 204,VT-DEF,BOM,DEL,15:25,17:30,176
UK 811,VT-GHI,BOM,CCU,14:20,16:45,158
UK 811,VT-GHI,CCU,BOM,17:25,19:50,163`;
