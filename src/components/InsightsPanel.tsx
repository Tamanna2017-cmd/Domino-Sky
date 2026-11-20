import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { formatTime, fmtMoney, fmtNumber } from '../engine/util';

export const InsightsPanel = ({
  onOpenAdvisorModal,
}: {
  onOpenAdvisorModal: () => void;
}) => {
  const sim = useSimStore((s) => s.sim);
  const baseline = useSimStore((s) => s.baseline);
  const dataset = useSimStore((s) => s.dataset);
  const selectedFlightId = useSimStore((s) => s.selectedFlightId);
  const selectFlight = useSimStore((s) => s.selectFlight);
  const actions = useSimStore((s) => s.actions);

  const [compareMode, setCompareMode] = useState<'current' | 'delta'>('current');

  const cur = sim.metrics;
  const base = baseline.metrics;

  // Deltas: Positive is good (savings)
  const delaySaved = Math.max(0, base.totalDelayMin - cur.totalDelayMin);
  const paxRescued = Math.max(0, base.paxStranded - cur.paxStranded);
  const costAvoided = Math.max(0, base.estimatedCost - cur.estimatedCost);
  const otpGain = cur.onTimePct - base.onTimePct;

  // Selected Flight Details & Causal Graph
  const selectedFlight = selectedFlightId ? dataset.flights.find((f) => f.id === selectedFlightId) : null;
  const selectedOutcome = selectedFlightId ? sim.outcomes[selectedFlightId] : null;

  // Parent causal flight
  const parentOutcome = selectedOutcome?.parentFlightId
    ? sim.outcomes[selectedOutcome.parentFlightId]
    : null;

  // Downstream flights caused by this flight
  const downstreamFlights = selectedFlightId
    ? Object.values(sim.outcomes).filter(
        (o) => o.parentFlightId === selectedFlightId || o.connectionParentId === selectedFlightId,
      )
    : [];

  // Missed connections on this flight
  const missesOnSelected = sim.misses.filter(
    (m) => m.fromFlightId === selectedFlightId || m.toFlightId === selectedFlightId,
  );

  return (
    <div className="flex h-full w-full flex-col select-none overflow-hidden border-l border-white/5 bg-ink-900/90 backdrop-blur-xl text-xs">
      {/* Header with Mode Toggle */}
      <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/60 px-4 py-2.5">
        <div>
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Network Health</span>
            <span
              className={`h-2 w-2 rounded-full ${
                cur.flightsCancelled > 0
                  ? 'bg-rose-500 animate-ping'
                  : cur.flightsDelayed > 0
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
          </h2>
          <div className="text-[10px] text-slate-400">Live Impact & Cascade Metrics</div>
        </div>

        <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
          <button
            className={`rounded px-2 py-1 text-[10px] font-semibold transition-all ${
              compareMode === 'current'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setCompareMode('current')}
          >
            Live KPIs
          </button>
          <button
            className={`rounded px-2 py-1 text-[10px] font-semibold transition-all ${
              compareMode === 'delta'
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setCompareMode('delta')}
          >
            Before vs After
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scroll-thin space-y-4">
        {/* BEFORE VS AFTER PROVE THE DECISION MATTERED BANNER */}
        {actions.length > 0 && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 shadow-glow">
            <div className="flex items-center justify-between text-emerald-300 font-bold mb-1">
              <span>RECOVERY IMPACT ACHIEVED</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded">
                {actions.length} ACTIONS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="rounded bg-black/40 p-2">
                <div className="text-[10px] text-slate-400">Delay Saved</div>
                <div className="font-mono text-base font-bold text-emerald-300">
                  -{fmtNumber(delaySaved)} min
                </div>
              </div>
              <div className="rounded bg-black/40 p-2">
                <div className="text-[10px] text-slate-400">Pax Rescued</div>
                <div className="font-mono text-base font-bold text-cyan-300">
                  +{fmtNumber(paxRescued)} pax
                </div>
              </div>
              <div className="rounded bg-black/40 p-2">
                <div className="text-[10px] text-slate-400">Cost Avoided</div>
                <div className="font-mono text-base font-bold text-amber-300">
                  ₹{fmtMoney(costAvoided)}
                </div>
              </div>
              <div className="rounded bg-black/40 p-2">
                <div className="text-[10px] text-slate-400">OTP Delta</div>
                <div className="font-mono text-base font-bold text-purple-300">
                  +{otpGain.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIVE DAMAGE METER & KPI GRID */}
        {compareMode === 'current' ? (
          <div className="space-y-2.5">
            <span className="label">Live Disruption Metrics</span>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Total Delay */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Delay</div>
                <div className="font-mono text-xl font-bold text-amber-300 mt-0.5">
                  {fmtNumber(cur.totalDelayMin)}{' '}
                  <span className="text-xs font-normal text-slate-400">min</span>
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">
                  Propagated: {fmtNumber(cur.propagatedDelayMin)} min
                </div>
              </div>

              {/* Flights Affected */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Late / Cancelled</div>
                <div className="font-mono text-xl font-bold text-rose-400 mt-0.5">
                  {cur.flightsDelayed} <span className="text-xs font-normal text-slate-400">late</span>
                  {cur.flightsCancelled > 0 && (
                    <span className="text-xs text-rose-500 ml-1">({cur.flightsCancelled} ✖)</span>
                  )}
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">
                  Total operated: {cur.flightsOperated}/{cur.flightsTotal}
                </div>
              </div>

              {/* Stranded Pax */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Stranded Pax</div>
                <div className="font-mono text-xl font-bold text-rose-300 mt-0.5">
                  {fmtNumber(cur.paxStranded)}
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">
                  Misconnected: {cur.paxMisconnected} pax
                </div>
              </div>

              {/* On-Time Performance */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">On-Time (OTP)</div>
                <div className="font-mono text-xl font-bold text-cyan-300 mt-0.5">
                  {cur.onTimePct.toFixed(1)}%
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">15-min arrival threshold</div>
              </div>

              {/* Amplification Factor */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Amplification</div>
                <div className="font-mono text-xl font-bold text-purple-300 mt-0.5">
                  {cur.amplificationFactor.toFixed(2)}x
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">Downstream / Root delay</div>
              </div>

              {/* Estimated Cost */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Est. Damage Cost</div>
                <div className="font-mono text-xl font-bold text-amber-400 mt-0.5">
                  ₹{fmtMoney(cur.estimatedCost)}
                </div>
                <div className="text-[9.5px] text-slate-500 mt-1">Delay + Pax + Cancel fees</div>
              </div>
            </div>
          </div>
        ) : (
          /* COMPARISON VIEW (BASELINE VS CURRENT) */
          <div className="space-y-3">
            <span className="label">Do-Nothing Baseline vs Current Decisions</span>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 border-b border-white/10 pb-1">
                <span>METRIC</span>
                <span className="text-right">DO-NOTHING</span>
                <span className="text-right text-emerald-300">CURRENT</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1 border-b border-white/5">
                <span className="text-slate-300">Delay (min)</span>
                <span className="text-right text-rose-400">{fmtNumber(base.totalDelayMin)}</span>
                <span className="text-right text-emerald-300 font-bold">{fmtNumber(cur.totalDelayMin)}</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1 border-b border-white/5">
                <span className="text-slate-300">Late Flights</span>
                <span className="text-right text-rose-400">{base.flightsDelayed}</span>
                <span className="text-right text-emerald-300 font-bold">{cur.flightsDelayed}</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1 border-b border-white/5">
                <span className="text-slate-300">Cancelled</span>
                <span className="text-right text-rose-400">{base.flightsCancelled}</span>
                <span className="text-right text-emerald-300 font-bold">{cur.flightsCancelled}</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1 border-b border-white/5">
                <span className="text-slate-300">Stranded Pax</span>
                <span className="text-right text-rose-400">{fmtNumber(base.paxStranded)}</span>
                <span className="text-right text-emerald-300 font-bold">{fmtNumber(cur.paxStranded)}</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1 border-b border-white/5">
                <span className="text-slate-300">OTP %</span>
                <span className="text-right text-rose-400">{base.onTimePct.toFixed(1)}%</span>
                <span className="text-right text-emerald-300 font-bold">{cur.onTimePct.toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-3 font-mono text-[11px] py-1">
                <span className="text-slate-300">Total Cost</span>
                <span className="text-right text-rose-400">₹{fmtMoney(base.estimatedCost)}</span>
                <span className="text-right text-emerald-300 font-bold">₹{fmtMoney(cur.estimatedCost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* SMART ADVISOR CALLOUT */}
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 shadow-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🤖</span>
              <div>
                <div className="font-bold text-white uppercase text-[11px]">AI Smart Recovery Advisor</div>
                <div className="text-[10px] text-cyan-300">Optimal recovery actions available</div>
              </div>
            </div>
            <button
              className="btn btn-primary !py-1 !px-2.5 !text-[11px]"
              onClick={onOpenAdvisorModal}
            >
              Open Advisor →
            </button>
          </div>
        </div>

        {/* CAUSAL GRAPH INSPECTOR ("SHOW THE DOMINO") */}
        <div className="space-y-2 pt-2">
          <span className="label">Causal Graph Inspector ("Show the Domino")</span>
          {selectedFlight && selectedOutcome ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <span className="font-mono text-sm font-bold text-cyan-300">
                    {selectedFlight.flightNo}
                  </span>
                  <span className="ml-2 font-mono text-slate-400">({selectedOutcome.tailId})</span>
                </div>
                <button
                  className="text-[10px] text-slate-400 hover:text-white"
                  onClick={() => selectFlight(null)}
                >
                  Clear
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white">
                  {selectedFlight.origin} → {selectedFlight.dest}
                </span>
                <span className="font-mono text-slate-300">
                  {formatTime(selectedOutcome.schedDep)} → {formatTime(selectedOutcome.schedArr)}
                </span>
              </div>

              {/* Status and Delay Tag */}
              <div className="flex items-center justify-between rounded bg-black/40 p-2">
                <span className="text-slate-400">Operational Delay:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedOutcome.arrDelay > 0 ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  {selectedOutcome.arrDelay > 0 ? `+${selectedOutcome.arrDelay} min` : 'ON TIME'}
                </span>
              </div>

              {/* Causal Domino Root */}
              <div className="rounded bg-black/40 p-2 text-[11px] space-y-1">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Root Cause:</div>
                {selectedOutcome.cause === 'ROOT_WEATHER' ? (
                  <div className="text-rose-300 font-medium">
                    ⚡ Direct Weather Disruption at {selectedOutcome.origin}
                  </div>
                ) : selectedOutcome.cause === 'PROPAGATED' && parentOutcome ? (
                  <div>
                    <div className="text-amber-300 font-medium">
                      🔗 Propagated along aircraft {selectedOutcome.tailId}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Pushed by prior leg <span className="font-mono text-white">{parentOutcome.flightNo}</span> (+{parentOutcome.arrDelay}m late)
                    </div>
                    <div className="text-[10px] text-purple-300 font-mono">
                      Cascade Depth: {selectedOutcome.cascadeDepth} domino levels
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400">Operating according to original timetable.</div>
                )}
              </div>

              {/* Downstream Impact Victims */}
              {downstreamFlights.length > 0 && (
                <div className="rounded bg-black/40 p-2 text-[11px]">
                  <div className="text-[10px] text-amber-400 font-semibold uppercase">
                    Downstream Victims ({downstreamFlights.length}):
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {downstreamFlights.map((df) => (
                      <div key={df.flightId} className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-slate-300">
                          {df.flightNo} ({df.origin}→{df.dest})
                        </span>
                        <span className="text-rose-400">+{df.arrDelay}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Broken Connections */}
              {missesOnSelected.length > 0 && (
                <div className="rounded bg-rose-950/30 border border-rose-500/30 p-2 text-[11px]">
                  <div className="text-[10px] text-rose-300 font-semibold uppercase">
                    Broken Passenger Connections ({missesOnSelected.length}):
                  </div>
                  <div className="mt-1 space-y-1">
                    {missesOnSelected.map((m, i) => (
                      <div key={`m-${i}`} className="text-[10px] text-rose-200">
                        • {m.pax} pax missed layover to {m.toFlightId} at {m.airport}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
              Click any flight on the Map or Timeline to trace its causal domino trail and downstream victims.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
