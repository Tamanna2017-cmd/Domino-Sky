import { useMemo } from 'react';
import { useSimStore } from '../store/useSimStore';

interface NodePos {
  code: string;
  name: string;
  city: string;
  x: number;
  y: number;
  delayOutMin: number;
  flightsOut: number;
  hasStorm: boolean;
}

export const NetworkGraph = () => {
  const dataset = useSimStore((s) => s.dataset);
  const sim = useSimStore((s) => s.sim);
  const weather = useSimStore((s) => s.weather);
  const selectedAirport = useSimStore((s) => s.selectedAirport);
  const selectAirport = useSimStore((s) => s.selectAirport);

  const WIDTH = 900;
  const HEIGHT = 700;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;

  // Compute delay generated per airport
  const airportMetrics = useMemo(() => {
    const delayOut = new Map<string, number>();
    const countOut = new Map<string, number>();

    for (const f of dataset.flights) {
      const out = sim.outcomes[f.id];
      const d = out?.depDelay ?? 0;
      delayOut.set(f.origin, (delayOut.get(f.origin) ?? 0) + d);
      countOut.set(f.origin, (countOut.get(f.origin) ?? 0) + 1);
    }

    return { delayOut, countOut };
  }, [dataset.flights, sim.outcomes]);

  const weatherAirports = useMemo(() => new Set(weather.map((w) => w.airport)), [weather]);

  // Arrange airports in an organic topological layout
  const nodes = useMemo(() => {
    const list: NodePos[] = [];
    const count = dataset.airports.length;
    // Hub airports placed closer to center, spokes on outer ring
    dataset.airports.forEach((ap, idx) => {
      const isMega = ap.hourlyCapacity >= 14;
      const r = isMega ? 160 : 260 + (idx % 3) * 25;
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const x = CX + r * Math.cos(angle);
      const y = CY + r * Math.sin(angle);

      list.push({
        code: ap.code,
        name: ap.name,
        city: ap.city,
        x,
        y,
        delayOutMin: airportMetrics.delayOut.get(ap.code) ?? 0,
        flightsOut: airportMetrics.countOut.get(ap.code) ?? 0,
        hasStorm: weatherAirports.has(ap.code),
      });
    });
    return list;
  }, [dataset.airports, airportMetrics, weatherAirports, CX, CY]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.code, n])), [nodes]);

  // Directed links between airports carrying delay
  const links = useMemo(() => {
    const linkMap = new Map<string, { from: NodePos; to: NodePos; delayMin: number; flightCount: number }>();

    for (const f of dataset.flights) {
      const out = sim.outcomes[f.id];
      const fromNode = nodeMap.get(f.origin);
      const toNode = nodeMap.get(f.dest);
      if (!fromNode || !toNode) continue;

      const key = `${f.origin}->${f.dest}`;
      const existing = linkMap.get(key) || {
        from: fromNode,
        to: toNode,
        delayMin: 0,
        flightCount: 0,
      };
      existing.delayMin += out?.arrDelay ?? 0;
      existing.flightCount++;
      linkMap.set(key, existing);
    }

    return Array.from(linkMap.values());
  }, [dataset.flights, sim.outcomes, nodeMap]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />

      {/* Header Info */}
      <div className="absolute top-4 left-4 z-20 rounded-xl border border-white/10 bg-ink-900/80 p-3 backdrop-blur-md">
        <h3 className="font-semibold text-white">FORCE-DIRECTED DELAY CASCADE GRAPH</h3>
        <p className="text-xs text-slate-400">
          Visualizing how delays leak from origin hubs to regional stations across aircraft rotations.
        </p>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
        <defs>
          <linearGradient id="link-grad-delay" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Links */}
        {links.map(({ from, to, delayMin }, i) => {
          const isDelayed = delayMin > 30;
          const stroke = isDelayed ? 'url(#link-grad-delay)' : 'rgba(56, 189, 248, 0.15)';
          const strokeWidth = isDelayed ? Math.min(6, 1.5 + delayMin / 50) : 1;

          return (
            <g key={`l-${i}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={isDelayed ? '4 4' : undefined}
                className={isDelayed ? 'animate-dashrun' : ''}
              />
            </g>
          );
        })}

        {/* Airport Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedAirport === node.code;
          const r = Math.max(16, Math.min(32, 14 + node.flightsOut * 1.5));
          let fill = '#08101f';
          let stroke = '#00f0ff';

          if (node.hasStorm) {
            stroke = '#ef4444';
            fill = '#450a0a';
          } else if (node.delayOutMin > 100) {
            stroke = '#f59e0b';
            fill = '#451a03';
          }

          return (
            <g
              key={node.code}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer transition-all duration-300 hover:scale-110"
              onClick={() => selectAirport(node.code)}
            >
              {/* Outer Glow */}
              <circle
                r={r + 6}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeOpacity={isSelected ? 0.9 : 0.25}
                className={node.hasStorm ? 'animate-pulse' : ''}
              />

              {/* Node Body */}
              <circle r={r} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} />

              {/* Label */}
              <text
                y="-2"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                className="font-mono"
              >
                {node.code}
              </text>
              <text
                y="11"
                textAnchor="middle"
                fill={node.delayOutMin > 0 ? '#fbbf24' : '#94a3b8'}
                fontSize="8"
                fontWeight="bold"
                className="font-mono"
              >
                {node.delayOutMin > 0 ? `+${node.delayOutMin}m` : `${node.flightsOut} flt`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
