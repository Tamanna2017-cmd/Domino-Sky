import type { Airport } from '../engine/types';

/** Sixteen Indian stations from official dataset with realistic coordinates and hourly departure capacity. */
export const AIRPORTS: Airport[] = [
  { code: 'DEL', name: 'Indira Gandhi Intl', city: 'Delhi', lat: 28.5562, lon: 77.1, hourlyCapacity: 16 },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj Intl', city: 'Mumbai', lat: 19.0896, lon: 72.8656, hourlyCapacity: 14 },
  { code: 'BLR', name: 'Kempegowda Intl', city: 'Bengaluru', lat: 13.1986, lon: 77.7066, hourlyCapacity: 14 },
  { code: 'HYD', name: 'Rajiv Gandhi Intl', city: 'Hyderabad', lat: 17.2403, lon: 78.4294, hourlyCapacity: 12 },
  { code: 'MAA', name: 'Chennai Intl', city: 'Chennai', lat: 12.9941, lon: 80.1709, hourlyCapacity: 10 },
  { code: 'CCU', name: 'Netaji Subhas Chandra Bose Intl', city: 'Kolkata', lat: 22.6547, lon: 88.4467, hourlyCapacity: 10 },
  { code: 'AMD', name: 'Sardar Vallabhbhai Patel Intl', city: 'Ahmedabad', lat: 23.0772, lon: 72.6347, hourlyCapacity: 9 },
  { code: 'COK', name: 'Cochin Intl', city: 'Kochi', lat: 10.152, lon: 76.4019, hourlyCapacity: 8 },
  { code: 'GOI', name: 'Dabolim Airport', city: 'Goa', lat: 15.3808, lon: 73.8314, hourlyCapacity: 6 },
  { code: 'PNQ', name: 'Pune Airport', city: 'Pune', lat: 18.5821, lon: 73.9197, hourlyCapacity: 6 },
  { code: 'JAI', name: 'Jaipur Intl', city: 'Jaipur', lat: 26.8242, lon: 75.8122, hourlyCapacity: 6 },
  { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi Intl', city: 'Guwahati', lat: 26.1061, lon: 91.5859, hourlyCapacity: 5 },
  { code: 'LKO', name: 'Chaudhary Charan Singh Intl', city: 'Lucknow', lat: 26.7606, lon: 80.8893, hourlyCapacity: 6 },
  { code: 'IXC', name: 'Chandigarh Intl', city: 'Chandigarh', lat: 30.6735, lon: 76.7885, hourlyCapacity: 5 },
  { code: 'BBI', name: 'Biju Patnaik Intl', city: 'Bhubaneswar', lat: 20.2444, lon: 85.8178, hourlyCapacity: 5 },
  { code: 'TRV', name: 'Trivandrum Intl', city: 'Thiruvananthapuram', lat: 8.4821, lon: 76.9201, hourlyCapacity: 5 },
];

export const AIRPORT_BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a] as const));

export const getAirport = (code: string): Airport | undefined =>
  AIRPORT_BY_CODE.get(code.trim().toUpperCase());

/** Rough traffic weight used by the synthetic generator. */
export const AIRPORT_WEIGHT: Record<string, number> = {
  DEL: 3,
  BOM: 3,
  BLR: 2.4,
  HYD: 2,
  MAA: 2,
  CCU: 1.8,
  AMD: 1.4,
  PNQ: 1.2,
  GOI: 1.1,
  JAI: 1,
  COK: 1,
  LKO: 1,
  GAU: 0.9,
  IXC: 0.8,
  BBI: 0.8,
  TRV: 0.8,
};
