import { useMemo, useState } from 'react';
import { geoMercator, geoPath, geoInterpolate } from 'd3-geo';
import { INDIA_FEATURE } from '../data/india';
import { useSimStore } from '../store/useSimStore';
import type { Airport, FlightOutcome } from '../engine/types';
import { formatTime } from '../engine/util';

const MAP_WIDTH = 900;
const MAP_HEIGHT = 800;

export const MapIndia = ({
  onSelectAirport,
}: {
  onSelectAirport?: (code: string) => void;
}) => {
  const dataset = useSimStore((s) => s.dataset);
  const sim = useSimStore((s) => s.sim);
  const weather = useSimStore((s) => s.weather);
  const clock = useSimStore((s) => s.clock);
  const showArcs = useSimStore((s) => s.showArcs);
  const selectedFlightId = useSimStore((s) => s.selectedFlightId);
  const selectedAirport = useSimStore((s) => s.selectedAirport);
  const selectFlight = useSimStore((s) => s.selectFlight);
  const selectAirport = useSimStore((s) => s.selectAirport);

  const [hoveredFlight, setHoveredFlight] = useState<string | null>(null);
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Setup D3 Mercator projection fitted to India's bounding box
  const projection = useMemo(() => {
    return geoMercator()
      .center([82.5, 22.0])
      .scale(1200)
      .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
  }, []);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);
  const indiaPath = useMemo(() => pathGenerator(INDIA_FEATURE) || '', [pathGenerator]);

  const airportMap = useMemo(() => {
    const map = new Map<string, Airport>();
    for (const a of dataset.airports) map.set(a.code, a);
    return map;
  }, [dataset.airports]);

  // Projected airport screen positions
  const airportPositions = useMemo(() => {
    const positions = new Map<string, [number, number]>();
    for (const a of dataset.airports) {
      const pt = projection([a.lon, a.lat]);
      if (pt) positions.set(a.code, pt);
    }
    return positions;
  }, [dataset.airports, projection]);

  // Causal & Domino trail of selected flight
  const selectedChain = useMemo(() => {
    if (!selectedFlightId) return { upstream: new Set<string>(), downstream: new Set<string>(), tailFlights: [] as string[] };
    const outcome = sim.outcomes[selectedFlightId];
    if (!outcome) return { upstream: new Set<string>(), downstream: new Set<string>(), tailFlights: [] as string[] };

    const tailFlights = sim.chainByTail[outcome.tailId] || [];
    const upstream = new Set<string>();
    const downstream = new Set<string>();

    // Trace upstream dominoes
    let cur: string | undefined = outcome.parentFlightId;
    while (cur && !upstream.has(cur)) {
      upstream.add(cur);
      cur = sim.outcomes[cur]?.parentFlightId;
    }

    // Trace downstream dominoes
    for (const [id, o] of Object.entries(sim.outcomes)) {
      if (o.parentFlightId === selectedFlightId || o.connectionParentId === selectedFlightId) {
        downstream.add(id);
      }
    }

    return { upstream, downstream, tailFlights };
  }, [selectedFlightId, sim]);

  // Calculate live airborne flights at current simulation clock
  const activeFlights = useMemo(() => {
    const list: Array<{
      flightId: string;
      outcome: FlightOutcome;
      fromPos: [number, number];
      toPos: [number, number];
      curPos: [number, number];
      heading: number;
      progress: number;
      isDelayed: boolean;
      isCancelled: boolean;
    }> = [];

    for (const f of dataset.flights) {
      const outcome = sim.outcomes[f.id];
      if (!outcome || outcome.status === 'CANCELLED') continue;
      if (outcome.actualDep == null || outcome.actualArr == null) continue;

      const fromPt = airportPositions.get(f.origin);
      const toPt = airportPositions.get(f.dest);
      const origAp = airportMap.get(f.origin);
      const destAp = airportMap.get(f.dest);

      if (!fromPt || !toPt || !origAp || !destAp) continue;

      // Check if airborne at current clock
      if (clock >= outcome.actualDep && clock <= outcome.actualArr) {
        const total = Math.max(1, outcome.actualArr - outcome.actualDep);
        const elapsed = clock - outcome.actualDep;
        const t = Math.max(0, Math.min(1, elapsed / total));

        // Spherical interpolation
        const interpolator = geoInterpolate([origAp.lon, origAp.lat], [destAp.lon, destAp.lat]);
        const curCoord = interpolator(t);
        const curPt = projection(curCoord);

        const t0 = Math.max(0, t - 0.005);
        const t1 = Math.min(1, t + 0.005);
        const p0 = projection(interpolator(t0));
        const p1 = projection(interpolator(t1));

        if (curPt && p0 && p1) {
          const dx = p1[0] - p0[0];
          const dy = p1[1] - p0[1];
          const heading = Math.atan2(dy, dx) * (180 / Math.PI);

          list.push({
            flightId: f.id,
            outcome,
            fromPos: fromPt,
            toPos: toPt,
            curPos: curPt,
            heading,
            progress: t,
            isDelayed: outcome.arrDelay > 15,
            isCancelled: false,
          });
        }
      }
    }

    return list;
  }, [dataset.flights, sim.outcomes, clock, airportPositions, airportMap, projection]);

  // Weather events active at current clock or overall
  const weatherMap = useMemo(() => {
    const map = new Map<string, (typeof weather)[0]>();
    for (const w of weather) {
      map.set(w.airport, w);
    }
    return map;
  }, [weather]);

  // Generate smooth curved arc paths for pairs of airports
  const arcCurves = useMemo(() => {
    const pairs = new Map<string, { from: [number, number]; to: [number, number]; key: string }>();
    for (const f of dataset.flights) {
      const from = airportPositions.get(f.origin);
      const to = airportPositions.get(f.dest);
      if (!from || !to) continue;
      const key = `${f.origin}-${f.dest}`;
      if (!pairs.has(key)) {
        pairs.set(key, { from, to, key });
      }
    }
    return Array.from(pairs.values()).map(({ from, to, key }) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const dist = Math.hypot(dx, dy);
      const cx = (from[0] + to[0]) / 2 - (dy / dist) * Math.min(60, dist * 0.18);
      const cy = (from[1] + to[1]) / 2 + (dx / dist) * Math.min(60, dist * 0.18);
      const d = `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`;
      return { key, d, from, to };
    });
  }, [dataset.flights, airportPositions]);

  const activeFlightHovered = hoveredFlight ? sim.outcomes[hoveredFlight] : null;
  const activeAirportHovered = hoveredAirport ? airportMap.get(hoveredAirport) : null;

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden bg-ink-950"
      onMouseMove={(e) => {
        if (!hoveredFlight && !hoveredAirport) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'map-backdrop') {
          selectFlight(null);
          selectAirport(null);
        }
      }}
    >
      {/* Background Atmosphere & Radial Grid Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(14,45,74,0.45)_0%,rgba(3,7,18,0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      {/* SVG Canvas */}
      <svg
        id="map-backdrop"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Neon filters */}
          <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="storm-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feColorMatrix type="matrix" values="1 0 0 0 0.9  0 0.2 0 0 0.1  0 0 0.2 0 0.1  0 0 0 1 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients */}
          <linearGradient id="arc-gradient-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="arc-gradient-amber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="arc-gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
          </linearGradient>

          {/* Radar Sweep Effect */}
          <radialGradient id="radar-sweep-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.12" />
            <stop offset="80%" stopColor="#00f0ff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Radar Sweep circle over central India */}
        <g transform={`translate(${MAP_WIDTH / 2}, ${MAP_HEIGHT / 2})`} className="pointer-events-none opacity-40">
          <circle r="360" fill="none" stroke="rgba(34, 211, 238, 0.08)" strokeWidth="1" strokeDasharray="4 8" />
          <circle r="240" fill="none" stroke="rgba(34, 211, 238, 0.06)" strokeWidth="1" />
          <circle r="120" fill="none" stroke="rgba(34, 211, 238, 0.05)" strokeWidth="1" />
        </g>

        {/* India Outline Polygon */}
        <path
          d={indiaPath}
          fill="rgba(10, 22, 38, 0.7)"
          stroke="rgba(56, 189, 248, 0.35)"
          strokeWidth="1.5"
          className="transition-colors duration-500 hover:fill-[rgba(12,28,48,0.8)]"
          filter="url(#neon-glow)"
        />

        {/* Route Arcs between airports */}
        {showArcs && (
          <g className="routes-layer">
            {arcCurves.map(({ key, d }) => (
              <path
                key={key}
                d={d}
                fill="none"
                stroke="url(#arc-gradient-cyan)"
                strokeWidth="1"
                strokeDasharray="2 4"
                className="opacity-40 transition-opacity duration-300 hover:opacity-90"
              />
            ))}
          </g>
        )}

        {/* Selected Flight Tail Chain Domino Highlights */}
        {selectedFlightId && (
          <g className="domino-chain-layer">
            {selectedChain.tailFlights.map((fid, idx) => {
              const out = sim.outcomes[fid];
              if (!out) return null;
              const pFrom = airportPositions.get(out.origin);
              const pTo = airportPositions.get(out.dest);
              if (!pFrom || !pTo) return null;

              const isSelected = fid === selectedFlightId;
              const isUpstream = selectedChain.upstream.has(fid);
              const isDownstream = selectedChain.downstream.has(fid);

              let stroke = '#00f0ff';
              if (isSelected) stroke = '#f59e0b';
              else if (isUpstream) stroke = '#ef4444';
              else if (isDownstream) stroke = '#fbbf24';

              const dx = pTo[0] - pFrom[0];
              const dy = pTo[1] - pFrom[1];
              const dist = Math.hypot(dx, dy);
              const cx = (pFrom[0] + pTo[0]) / 2 - (dy / dist) * Math.min(60, dist * 0.22);
              const cy = (pFrom[1] + pTo[1]) / 2 + (dx / dist) * Math.min(60, dist * 0.22);
              const d = `M ${pFrom[0]} ${pFrom[1]} Q ${cx} ${cy} ${pTo[0]} ${pTo[1]}`;

              return (
                <g key={`chain-${fid}`}>
                  {/* Glowing wide halo */}
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="5"
                    strokeOpacity="0.4"
                    filter="url(#neon-glow)"
                  />
                  {/* Animated dash line showing domino travel direction */}
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2.5"
                    strokeDasharray="6 6"
                    className="animate-dashrun"
                  />
                  {/* Chain leg number badge */}
                  <circle cx={cx} cy={cy} r="10" fill="#08101f" stroke={stroke} strokeWidth="1.5" />
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill={stroke}
                    fontSize="9"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {idx + 1}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Active Weather Storm Clouds & Lightning Over Affected Airports */}
        {weather.map((ev) => {
          const pt = airportPositions.get(ev.airport);
          if (!pt) return null;

          const isActiveNow = clock >= ev.startTime && clock <= ev.startTime + ev.duration;
          const isSeverity3 = ev.severity === 3;
          const isSeverity2 = ev.severity === 2;

          return (
            <g
              key={ev.id}
              transform={`translate(${pt[0]}, ${pt[1]})`}
              className="cursor-pointer"
              onClick={() => {
                selectAirport(ev.airport);
                if (onSelectAirport) onSelectAirport(ev.airport);
              }}
            >
              {/* Radar disruption radius ring */}
              <circle
                r={isSeverity3 ? 55 : isSeverity2 ? 42 : 32}
                fill={isSeverity3 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}
                stroke={isSeverity3 ? '#ef4444' : '#f59e0b'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className={isActiveNow ? 'animate-pulse' : 'opacity-60'}
              />

              {/* Pulsing shockwave ring if storm is active right now */}
              {isActiveNow && (
                <circle
                  r="50"
                  fill="none"
                  stroke={isSeverity3 ? '#ef4444' : '#f59e0b'}
                  strokeWidth="2"
                  className="animate-pulseRing origin-center"
                />
              )}

              {/* Storm Cloud Icon Graphic */}
              <g transform="translate(-16, -26)" className="filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                <path
                  d="M7 19h14a5 5 0 0 0 1.8-9.7 7 7 0 0 0-13.6-2A5 5 0 0 0 7 19z"
                  fill={isSeverity3 ? '#450a0a' : '#451a03'}
                  stroke={isSeverity3 ? '#f87171' : '#fbbf24'}
                  strokeWidth="1.5"
                />
                {/* Lightning Bolt */}
                <path
                  d="M13 14l-2 5h4l-2 5"
                  fill="none"
                  stroke={isSeverity3 ? '#fef08a' : '#fef08a'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isActiveNow ? 'animate-bounce' : ''}
                />
              </g>

              {/* Storm Label Pill */}
              <g transform="translate(0, -36)">
                <rect
                  x="-32"
                  y="-11"
                  width="64"
                  height="16"
                  rx="8"
                  fill="#0b0f19"
                  stroke={isSeverity3 ? '#ef4444' : '#f59e0b'}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  fill={isSeverity3 ? '#fca5a5' : '#fde68a'}
                  fontSize="8.5"
                  fontWeight="bold"
                  className="font-mono tracking-wider uppercase"
                >
                  {ev.severity === 3 ? 'CLOSED' : ev.severity === 2 ? 'STOP' : 'DELAY'}
                </text>
              </g>
            </g>
          );
        })}

        {/* Airport Nodes */}
        {dataset.airports.map((ap) => {
          const pt = airportPositions.get(ap.code);
          if (!pt) return null;

          const isSelected = selectedAirport === ap.code;
          const hasWeather = weatherMap.has(ap.code);
          const ev = weatherMap.get(ap.code);
          const isActiveWeather = ev && clock >= ev.startTime && clock <= ev.startTime + ev.duration;

          // Check if airport currently has delayed departures
          let delayedDeps = 0;
          for (const f of dataset.flights) {
            if (f.origin === ap.code) {
              const out = sim.outcomes[f.id];
              if (out && out.depDelay > 15) delayedDeps++;
            }
          }

          let nodeColor = '#00f0ff';
          if (ev?.severity === 3) nodeColor = '#ef4444';
          else if (ev?.severity === 2 || delayedDeps > 2) nodeColor = '#f59e0b';

          return (
            <g
              key={ap.code}
              transform={`translate(${pt[0]}, ${pt[1]})`}
              className="cursor-pointer"
              onClick={() => {
                selectAirport(ap.code);
                if (onSelectAirport) onSelectAirport(ap.code);
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setHoveredAirport(ap.code);
              }}
              onMouseLeave={() => setHoveredAirport(null)}
            >
              {/* Radar pulse for hubs */}
              <circle
                r={ap.hourlyCapacity > 12 ? 14 : 10}
                fill="none"
                stroke={nodeColor}
                strokeWidth="1"
                strokeOpacity={isSelected ? '0.8' : '0.25'}
                className={isSelected || isActiveWeather ? 'animate-pulse' : ''}
              />

              {/* Airport Core Beacon */}
              <circle
                r={ap.hourlyCapacity > 12 ? 6.5 : 5}
                fill="#050a15"
                stroke={nodeColor}
                strokeWidth={isSelected ? '2.5' : '1.5'}
                filter="url(#neon-glow)"
              />
              <circle r={ap.hourlyCapacity > 12 ? 2.5 : 2} fill={nodeColor} />

              {/* Airport Code Tag */}
              <text
                x="9"
                y="3.5"
                fill={isSelected ? '#38bdf8' : hasWeather ? '#f87171' : '#cbd5e1'}
                fontSize="10"
                fontWeight={isSelected ? '700' : '600'}
                className="font-mono tracking-wider drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
              >
                {ap.code}
              </text>
            </g>
          );
        })}

        {/* Live Airborne Airplanes moving in real-time along great-circle arcs */}
        {activeFlights.map((af) => {
          const isSelected = selectedFlightId === af.flightId;
          const isHovered = hoveredFlight === af.flightId;
          const isChainMember = selectedChain.tailFlights.includes(af.flightId);

          let planeColor = '#38bdf8'; // neon cyan
          if (af.outcome.arrDelay > 60) planeColor = '#ef4444'; // deep delay
          else if (af.outcome.arrDelay > 15) planeColor = '#f59e0b'; // moderate delay
          if (isSelected) planeColor = '#a855f7'; // purple highlight

          return (
            <g
              key={`plane-${af.flightId}`}
              transform={`translate(${af.curPos[0]}, ${af.curPos[1]})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                selectFlight(af.flightId);
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setHoveredFlight(af.flightId);
              }}
              onMouseLeave={() => setHoveredFlight(null)}
            >
              {/* Generous touch / hover hit target to prevent jitter */}
              <circle r="16" fill="transparent" />

              {/* Delayed or selected halo */}
              {(af.isDelayed || isSelected || isChainMember) && (
                <circle
                  r={isSelected ? 14 : 10}
                  fill={planeColor}
                  fillOpacity={isSelected ? 0.35 : 0.2}
                  stroke={planeColor}
                  strokeWidth="1"
                  strokeOpacity={isSelected ? 0.8 : 0.4}
                  className="pointer-events-none animate-pulse"
                />
              )}

              {/* Airplane heading orientation */}
              <g transform={`rotate(${af.heading})`} className="pointer-events-none">
                {/* Jet shape SVG */}
                <path
                  d="M 0 -7 L 3 -1 L 8 2 L 8 4 L 3 3 L 2 7 L 4 9 L 4 10 L 0 9 L -4 10 L -4 9 L -2 7 L -3 3 L -8 4 L -8 2 L -3 -1 Z"
                  fill={planeColor}
                  stroke="#050a15"
                  strokeWidth="0.8"
                  filter={isSelected ? 'url(#neon-glow)' : undefined}
                />
              </g>

              {/* Small flight tag if selected or hovered or delayed */}
              {(isSelected || isHovered || af.isDelayed) && (
                <g transform="translate(10, -8)" className="pointer-events-none select-none">
                  <rect
                    x="-2"
                    y="-9"
                    width="48"
                    height="14"
                    rx="3"
                    fill="#08101f"
                    stroke={planeColor}
                    strokeWidth="0.8"
                    opacity="0.95"
                  />
                  <text
                    x="22"
                    y="1.5"
                    textAnchor="middle"
                    fill={planeColor}
                    fontSize="8.5"
                    fontWeight="bold"
                    className="font-mono"
                  >
                    {af.outcome.flightNo}
                  </text>
                  {af.outcome.arrDelay > 0 && (
                    <text
                      x="22"
                      y="11"
                      textAnchor="middle"
                      fill="#ef4444"
                      fontSize="7.5"
                      fontWeight="bold"
                      className="font-mono"
                    >
                      +{af.outcome.arrDelay}m
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {mousePos && (activeFlightHovered || activeAirportHovered) && (
        <div
          className="pointer-events-none absolute z-40 rounded-xl border border-white/10 bg-ink-900/90 p-3 text-xs shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(window.innerWidth - 260, mousePos.x + 16),
            top: Math.min(window.innerHeight - 200, mousePos.y + 16),
          }}
        >
          {activeFlightHovered && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1">
                <span className="font-mono font-bold text-cyan-300">{activeFlightHovered.flightNo}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {activeFlightHovered.tailId}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-bold text-white">{activeFlightHovered.origin}</span>
                <span>→</span>
                <span className="font-bold text-white">{activeFlightHovered.dest}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 text-[11px] text-slate-400">
                <div>
                  Sched Dep: <span className="font-mono text-white">{formatTime(activeFlightHovered.schedDep)}</span>
                </div>
                <div>
                  Actual Dep: <span className="font-mono text-white">{activeFlightHovered.actualDep != null ? formatTime(activeFlightHovered.actualDep) : 'N/A'}</span>
                </div>
                <div>
                  Sched Arr: <span className="font-mono text-white">{formatTime(activeFlightHovered.schedArr)}</span>
                </div>
                <div>
                  Actual Arr: <span className="font-mono text-white">{activeFlightHovered.actualArr != null ? formatTime(activeFlightHovered.actualArr) : 'N/A'}</span>
                </div>
              </div>
              {activeFlightHovered.arrDelay > 0 && (
                <div className="flex items-center justify-between text-rose-400 font-semibold pt-1">
                  <span>Delay:</span>
                  <span className="font-mono">+{activeFlightHovered.arrDelay} min</span>
                </div>
              )}
              {activeFlightHovered.cause !== 'NONE' && (
                <div className="text-[10px] text-amber-300 font-mono">
                  Cause: {activeFlightHovered.cause === 'ROOT_WEATHER' ? 'Storm at Origin' : 'Rotational Cascade'} (Depth: {activeFlightHovered.cascadeDepth})
                </div>
              )}
            </div>
          )}

          {!activeFlightHovered && activeAirportHovered && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                <span className="font-mono font-bold text-cyan-300">{activeAirportHovered.code}</span>
                <span className="text-[10px] text-slate-400">{activeAirportHovered.city}</span>
              </div>
              <div className="text-white font-medium">{activeAirportHovered.name}</div>
              <div className="text-[11px] text-slate-400">
                Hourly Capacity: <span className="text-white font-mono">{activeAirportHovered.hourlyCapacity} flt/hr</span>
              </div>
              {weatherMap.has(activeAirportHovered.code) && (
                <div className="mt-1 rounded bg-rose-500/20 p-1 text-[10px] text-rose-200 border border-rose-500/30">
                  ⚠️ Weather Disruption Active
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend & Simulation Watermark */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-ink-900/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-glow" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Propagated Delay</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          <span>Root Storm / Closure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-400" />
          <span>Selected Chain</span>
        </div>
      </div>
    </div>
  );
};
