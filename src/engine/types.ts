/**
 * Domino Sky — core domain types.
 * Times are "minutes since midnight" for a single operating day (may exceed 1440).
 */
export type Minute = number;

export interface Airport {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  /** Maximum scheduled departures per rolling hour. */
  hourlyCapacity: number;
}

export interface Aircraft {
  tailId: string;
  type: string;
  seats: number;
  /** Home station the aircraft starts the day at. */
  base: string;
  /** Standby aircraft can be deployed as a recovery lever. */
  standby?: boolean;
}

export interface Flight {
  id: string;
  flightNo: string;
  tailId: string;
  origin: string;
  dest: string;
  schedDep: Minute;
  schedArr: Minute;
  pax: number;
  /** onwardFlightId -> number of passengers connecting from this flight. */
  connectingPaxMap: Record<string, number>;
}

/** 1 = reduced capacity, 2 = departure ground stop, 3 = full closure. */
export type Severity = 1 | 2 | 3;

export interface WeatherEvent {
  id: string;
  airport: string;
  startTime: Minute;
  duration: number;
  severity: Severity;
  /** When true, arrivals that would land inside a severity-3 closure divert. */
  diversions?: boolean;
  label?: string;
}

export type ActionType = 'swap' | 'cancel' | 'hold' | 'spare' | 'retime' | 'rebook';

export interface RecoveryAction {
  id: string;
  type: ActionType;
  flightId?: string;
  otherFlightId?: string;
  minutes?: number;
  spareTailId?: string;
  note?: string;
  createdAt: number;
}

export interface SimSettings {
  /** Minimum ground turnaround between two legs of the same aircraft. */
  minTurnaround: number;
  /** Minimum connecting time for passengers, in minutes. */
  minConnect: number;
  /** A departure delayed beyond this is cancelled by the ops rule. */
  cancelDelayThreshold: number;
  /** On-time = arrival within this many minutes of schedule. */
  onTimeThreshold: number;
  delayCostPerMin: number;
  delayCostPerPaxMin: number;
  cancellationCost: number;
  diversionCost: number;
  misconnectCost: number;
  strandingCost: number;
  rebookCost: number;
}

export interface SimInput {
  airports: Airport[];
  aircraft: Aircraft[];
  flights: Flight[];
  weather: WeatherEvent[];
  actions: RecoveryAction[];
  settings: SimSettings;
}

export type FlightStatus = 'SCHEDULED' | 'DELAYED' | 'CANCELLED' | 'DIVERTED';
export type CauseTag = 'NONE' | 'ROOT_WEATHER' | 'PROPAGATED';

export interface FlightOutcome {
  flightId: string;
  flightNo: string;
  tailId: string;
  origin: string;
  dest: string;
  schedDep: Minute;
  schedArr: Minute;
  actualDep: Minute | null;
  actualArr: Minute | null;
  depDelay: number;
  arrDelay: number;
  status: FlightStatus;
  cause: CauseTag;
  /** Upstream leg on the same aircraft. */
  parentFlightId?: string;
  /** Inbound connection this departure was held for. */
  connectionParentId?: string;
  cascadeDepth: number;
  heldMinutes: number;
  ferryMinutes: number;
  directWeather: boolean;
  alternate?: string;
  /** Seats available on the operated aircraft. */
  seats: number;
}

export interface ConnectionMiss {
  fromFlightId: string;
  toFlightId: string;
  pax: number;
  airport: string;
  arrivalTime: number;
  departureTime: number;
}

export interface SavedConnection {
  fromFlightId: string;
  toFlightId: string;
  pax: number;
}

export interface CostBreakdown {
  delay: number;
  cancellation: number;
  passenger: number;
  recovery: number;
  total: number;
}

export interface Metrics {
  flightsTotal: number;
  flightsOperated: number;
  flightsAffected: number;
  flightsDelayed: number;
  flightsCancelled: number;
  flightsDiverted: number;
  totalDelayMin: number;
  directDelayMin: number;
  propagatedDelayMin: number;
  paxTotal: number;
  paxMisconnected: number;
  paxRebooked: number;
  paxStranded: number;
  paxOnCancelled: number;
  onTimePct: number;
  maxCascadeDepth: number;
  amplificationFactor: number;
  cost: CostBreakdown;
  estimatedCost: number;
}

export interface SimResult {
  outcomes: Record<string, FlightOutcome>;
  orderedIds: string[];
  /** tail -> ordered flight ids (final assignment after swaps/spares). */
  chainByTail: Record<string, string[]>;
  misses: ConnectionMiss[];
  savedConnections: SavedConnection[];
  rootFlightIds: string[];
  cancelledIds: string[];
  divertedIds: string[];
  metrics: Metrics;
}

export interface Dataset {
  airports: Airport[];
  aircraft: Aircraft[];
  flights: Flight[];
  label: string;
}
