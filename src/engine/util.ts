import type { Airport } from './types';

export const fmtTime = (min: number): string => {
  if (!Number.isFinite(min)) return '—';
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const formatTime = fmtTime;

export const fmtDuration = (min: number): string => {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
};

export const fmtNumber = (n: number): string => Math.round(n).toLocaleString('en-IN');

export const fmtMoney = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export const kmBetween = (a: Airport, b: Airport): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Empty ferry/repositioning flight: cruise 750 km/h + 20 min handling. */
export const ferryMinutes = (a?: Airport, b?: Airport): number => {
  if (!a || !b) return 90;
  return Math.max(35, Math.round((kmBetween(a, b) / 750) * 60) + 20);
};

/** Deterministic PRNG so the demo dataset and scenario generation are reproducible. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const uid = (prefix = 'id'): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
