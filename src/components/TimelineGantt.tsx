import { useMemo, useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { formatTime } from '../engine/util';

const MIN_START = 300; // 05:00
const MIN_END = 1440; // 24:00
const TOTAL_MINUTES = MIN_END - MIN_START;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 110;

export const TimelineGantt = ({
  onOpenRecoveryAction,
}: {
  onOpenRecoveryAction?: (flightId: string, actionType?: string) => void;
}) => {
  const dataset = useSimStore((s) => s.dataset);
  const sim = useSimStore((s) => s.sim);
  const weather = useSimStore((s) => s.weather);
  const clock = useSimStore((s) => s.clock);
  const setClock = useSimStore((s) => s.setClock);
  const selectedFlightId = useSimStore((s) => s.selectedFlightId);
  const selectFlight = useSimStore((s) => s.selectFlight);

  const [hoveredFlight, setHoveredFlight] = useState<string | null>(null);

  // All unique tails including standby tails
  const tails = useMemo(() => {
    const list = dataset.aircraft.map((a) => a.tailId);
    // Sort active tails first, standby tails last
    return list.sort((a, b) => {
      const aStandby = dataset.aircraft.find((x) => x.tailId === a)?.standby;
      const bStandby = dataset.aircraft.find((x) => x.tailId === b)?.standby;
      if (aStandby && !bStandby) return 1;
      if (!aStandby && bStandby) return -1;
      return a.localeCompare(b);
    });
  }, [dataset.aircraft]);

  // Flights grouped by tail
  const flightsByTail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of tails) map.set(t, []);
    for (const [t, ids] of Object.entries(sim.chainByTail)) {
      if (map.has(t)) map.set(t, ids);
      else map.set(t, ids);
    }
    return map;
  }, [tails, sim.chainByTail]);

  // Convert minute to percentage along timeline
  const minToPct = (m: number) => {
    const clamped = Math.max(MIN_START, Math.min(MIN_END, m));
    return ((clamped - MIN_START) / TOTAL_MINUTES) * 100;
  };

  // Hour markers
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = 5; h <= 24; h++) list.push(h * 60);
    return list;
  }, []);

  return (
    <div className="flex h-full w-full flex-col select-none overflow-hidden bg-ink-950 text-xs">
      {/* Timeline Controls & Quick Filter Bar */}
      <div className="flex items-center justify-between border-b border-white/5 bg-ink-900/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300">AIRCRAFT ROTATION GANTT</span>
          <span className="text-[11px] text-slate-500">
            {tails.length} tails · {dataset.flights.length} flight legs · Click any leg to recover
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-4 rounded bg-cyan-500/80" /> On-Time
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-4 rounded bg-amber-500" /> Propagated Delay
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-4 rounded bg-rose-500" /> Root Delay / Cancel
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-4 rounded bg-rose-500/20 border border-rose-500/50" /> Weather Closure
          </span>
        </div>
      </div>

      {/* Main Gantt Body */}
      <div className="relative flex-1 overflow-x-auto overflow-y-auto scroll-thin">
        <div className="min-w-[1000px] pb-12">
          {/* Timeline Header Hour Ticks */}
          <div className="sticky top-0 z-30 flex border-b border-white/10 bg-ink-900/95 backdrop-blur-md">
            <div
              className="sticky left-0 z-40 shrink-0 border-r border-white/10 bg-ink-900 px-3 py-2 font-mono font-bold text-slate-400"
              style={{ width: LABEL_WIDTH }}
            >
              TAIL / ROTATION
            </div>
            <div
              className="relative flex-1 py-2 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setClock(MIN_START + pct * TOTAL_MINUTES);
              }}
            >
              {hours.map((hMin) => (
                <div
                  key={hMin}
                  className="absolute -translate-x-1/2 font-mono text-[10px] text-slate-400"
                  style={{ left: `${minToPct(hMin)}%` }}
                >
                  {formatTime(hMin)}
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Grid Container */}
          <div className="relative">
            {/* Background Hour Grid Lines */}
            <div className="pointer-events-none absolute inset-0 left-[110px]">
              {hours.map((hMin) => (
                <div
                  key={`grid-${hMin}`}
                  className="absolute top-0 bottom-0 border-r border-white/[0.04]"
                  style={{ left: `${minToPct(hMin)}%` }}
                />
              ))}

              {/* Weather Disruption Window Shaded Bands */}
              {weather.map((ev) => {
                const startPct = minToPct(ev.startTime);
                const endPct = minToPct(ev.startTime + ev.duration);
                const widthPct = Math.max(0.5, endPct - startPct);
                return (
                  <div
                    key={`weather-band-${ev.id}`}
                    className="absolute top-0 bottom-0 border-x border-rose-500/40 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.06),rgba(239,68,68,0.06)_10px,rgba(239,68,68,0.12)_10px,rgba(239,68,68,0.12)_20px)]"
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  >
                    <div className="sticky top-10 flex items-center gap-1 bg-rose-950/80 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                      ⚡ {ev.airport} ({ev.duration}m)
                    </div>
                  </div>
                );
              })}

              {/* Real-time Simulation Clock Cursor Line */}
              <div
                className="absolute top-0 bottom-0 z-20 w-[2px] bg-cyan-400 shadow-[0_0_10px_#00f0ff]"
                style={{ left: `${minToPct(clock)}%` }}
              >
                <div className="sticky top-8 -translate-x-1/2 rounded bg-cyan-500 px-1 py-0.5 font-mono text-[9px] font-bold text-black shadow-glow">
                  {formatTime(clock)}
                </div>
              </div>
            </div>

            {/* Tail Rows */}
            {tails.map((tailId) => {
              const ac = dataset.aircraft.find((a) => a.tailId === tailId);
              const flightIds = flightsByTail.get(tailId) || [];
              const isStandby = ac?.standby;

              return (
                <div
                  key={tailId}
                  className="flex border-b border-white/[0.05] hover:bg-white/[0.02]"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Left Row Header */}
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center justify-between border-r border-white/10 bg-ink-900/95 px-3"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <div>
                      <div className="font-mono font-bold text-white flex items-center gap-1.5">
                        {tailId}
                        {isStandby && (
                          <span className="rounded bg-emerald-500/20 px-1 text-[8px] text-emerald-300 border border-emerald-500/30">
                            SPARE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {ac?.base} · {ac?.seats}s
                      </div>
                    </div>
                  </div>

                  {/* Flight Bars Area */}
                  <div className="relative flex-1">
                    {flightIds.map((fid, legIdx) => {
                      const out = sim.outcomes[fid];
                      if (!out) return null;

                      const isSelected = selectedFlightId === fid;
                      const isHovered = hoveredFlight === fid;

                      // Actual Dep & Arr times
                      const dep = out.actualDep ?? out.schedDep;
                      const arr = out.actualArr ?? out.schedArr;
                      const isCancelled = out.status === 'CANCELLED';

                      const leftPct = minToPct(dep);
                      const rightPct = minToPct(arr);
                      const widthPct = Math.max(1.8, rightPct - leftPct);

                      // Scheduled ghost bar
                      const schedLeftPct = minToPct(out.schedDep);
                      const schedWidthPct = Math.max(1.8, minToPct(out.schedArr) - schedLeftPct);

                      let barBg = 'bg-cyan-500/80 border-cyan-400';
                      if (isCancelled) barBg = 'bg-rose-950/80 border-rose-500 text-rose-300 line-through';
                      else if (out.cause === 'ROOT_WEATHER' || out.depDelay > 60)
                        barBg = 'bg-rose-500/80 border-rose-400';
                      else if (out.arrDelay > 15 || out.cause === 'PROPAGATED')
                        barBg = 'bg-amber-500/85 border-amber-300';

                      // Connecting domino arrow from previous leg
                      const prevFid = flightIds[legIdx - 1];
                      const prevOut = prevFid ? sim.outcomes[prevFid] : null;

                      return (
                        <div key={fid}>
                          {/* Ghost Scheduled Bar */}
                          {out.depDelay > 10 && !isCancelled && (
                            <div
                              className="pointer-events-none absolute top-1 h-2 rounded border border-dashed border-slate-500/40 bg-slate-800/30"
                              style={{
                                left: `${schedLeftPct}%`,
                                width: `${schedWidthPct}%`,
                              }}
                            />
                          )}

                          {/* Delay stretch connecting scheduled dep to actual dep */}
                          {out.depDelay > 10 && !isCancelled && (
                            <div
                              className="pointer-events-none absolute top-3 h-4 border-b border-rose-500/60 bg-rose-500/20"
                              style={{
                                left: `${schedLeftPct}%`,
                                width: `${Math.max(0.5, leftPct - schedLeftPct)}%`,
                              }}
                            />
                          )}

                          {/* Domino connector to previous leg */}
                          {prevOut && prevOut.actualArr != null && (
                            <div
                              className={`pointer-events-none absolute top-4 h-[2px] ${
                                out.cause === 'PROPAGATED'
                                  ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                                  : 'bg-slate-600/50'
                              }`}
                              style={{
                                left: `${minToPct(prevOut.actualArr)}%`,
                                width: `${Math.max(0.2, leftPct - minToPct(prevOut.actualArr))}%`,
                              }}
                            />
                          )}

                          {/* Flight Leg Bar */}
                          <div
                            className={`absolute top-2.5 h-6 cursor-pointer rounded border px-1.5 flex items-center justify-between text-[10px] font-semibold transition-all duration-150 ${barBg} ${
                              isSelected
                                ? 'ring-2 ring-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.7)] z-20 scale-[1.03]'
                                : isHovered
                                ? 'scale-[1.02] shadow-lg z-10'
                                : ''
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            onClick={() => {
                              selectFlight(fid);
                              if (onOpenRecoveryAction) onOpenRecoveryAction(fid);
                            }}
                            onMouseEnter={() => setHoveredFlight(fid)}
                            onMouseLeave={() => setHoveredFlight(null)}
                          >
                            <span className="truncate font-mono font-bold text-white">
                              {out.flightNo}
                            </span>
                            <span className="truncate font-mono text-[9px] text-white/90">
                              {out.origin}→{out.dest}
                            </span>
                            {out.arrDelay > 0 && !isCancelled && (
                              <span className="ml-1 rounded bg-black/40 px-1 py-0.2 text-[8.5px] font-bold text-amber-200">
                                +{out.arrDelay}m
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
