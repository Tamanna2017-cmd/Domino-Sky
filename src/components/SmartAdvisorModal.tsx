import { useState, useMemo } from 'react';
import { useSimStore } from '../store/useSimStore';
import { buildRecommendations, recoveryScore, gradeOf } from '../engine/advisor';
import { fmtMoney, fmtNumber } from '../engine/util';

export const SmartAdvisorModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const dataset = useSimStore((s) => s.dataset);
  const sim = useSimStore((s) => s.sim);
  const baseline = useSimStore((s) => s.baseline);
  const weather = useSimStore((s) => s.weather);
  const actions = useSimStore((s) => s.actions);
  const settings = useSimStore((s) => s.settings);
  const applyAction = useSimStore((s) => s.applyAction);

  const [optimizing, setOptimizing] = useState(false);
  const [optStep, setOptStep] = useState(0);

  // Compute recommendations
  const recs = useMemo(() => {
    return buildRecommendations(
      {
        airports: dataset.airports,
        aircraft: dataset.aircraft,
        flights: dataset.flights,
        weather,
        actions,
        settings,
      },
      sim,
      baseline,
      5,
    );
  }, [dataset, sim, baseline, weather, actions, settings]);

  // Scores
  const curScore = recoveryScore(sim.metrics, baseline.metrics);
  const curGrade = gradeOf(curScore);

  // Auto-optimize greedy loop
  const handleAutoOptimize = async () => {
    setOptimizing(true);
    setOptStep(0);

    // Apply up to 4 iterations
    for (let step = 1; step <= 4; step++) {
      setOptStep(step);
      // Wait 300ms for visual animation
      await new Promise((r) => setTimeout(r, 400));

      const store = useSimStore.getState();
      const currentRecs = buildRecommendations(
        {
          airports: store.dataset.airports,
          aircraft: store.dataset.aircraft,
          flights: store.dataset.flights,
          weather: store.weather,
          actions: store.actions,
          settings: store.settings,
        },
        store.sim,
        store.baseline,
        1,
      );

      if (!currentRecs.length || currentRecs[0].gain < 5) break;
      const top = currentRecs[0];
      store.applyAction(top.action, `Auto-Optimised: ${top.title}`);
    }

    setOptimizing(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-cyan-500/30 bg-ink-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-xl shadow-glow">
              🤖
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>AI RECOVERY ADVISOR</span>
                <span className="rounded bg-cyan-400/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-400/30">
                  PRESCRIPTIVE OPERATIONS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Monte Carlo candidate search & greedy cascade mitigation engine
              </p>
            </div>
          </div>
          <button
            className="btn !px-2.5 !py-1 text-slate-400 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-thin space-y-6">
          {/* Recovery Performance Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Score */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-extrabold shadow-lg"
                style={{
                  backgroundColor: `${curGrade.color}20`,
                  color: curGrade.color,
                  border: `2px solid ${curGrade.color}60`,
                }}
              >
                {curGrade.grade}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Recovery Score</div>
                <div className="font-mono text-2xl font-black text-white">{curScore} / 100</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{curGrade.blurb}</div>
              </div>
            </div>

            {/* Delay Impact */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase font-bold text-slate-400">Delay Saved / Baseline</div>
              <div className="font-mono text-xl font-bold text-emerald-300 mt-1">
                -{fmtNumber(Math.max(0, baseline.metrics.totalDelayMin - sim.metrics.totalDelayMin))} min
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Baseline was {fmtNumber(baseline.metrics.totalDelayMin)} delay-min
              </div>
            </div>

            {/* Cost Avoided */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase font-bold text-slate-400">Cost Avoided</div>
              <div className="font-mono text-xl font-bold text-amber-300 mt-1">
                ₹{fmtMoney(Math.max(0, baseline.metrics.estimatedCost - sim.metrics.estimatedCost))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Saved passenger rebooking & crew overtime
              </div>
            </div>
          </div>

          {/* Auto-Optimise Action Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-cyan-400/30 bg-cyan-950/20 p-4 shadow-glow">
            <div>
              <div className="font-bold text-cyan-200">Autonomous Network Auto-Optimiser</div>
              <p className="text-xs text-slate-300 mt-0.5">
                Greedily runs candidate swaps, holds, and cancellations to find the optimal global Pareto front.
              </p>
            </div>
            <button
              className="btn btn-primary !px-5 !py-2.5 font-bold shrink-0 text-xs flex items-center gap-2"
              onClick={handleAutoOptimize}
              disabled={optimizing || recs.length === 0}
            >
              {optimizing ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-cyan-300 animate-ping" />
                  <span>Optimising Step {optStep}...</span>
                </>
              ) : (
                <>
                  <span>⚡ Auto-Optimise Network</span>
                </>
              )}
            </button>
          </div>

          {/* Top Ranked Recommendations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="label">Ranked Recovery Actions ({recs.length})</span>
              <span className="text-[11px] text-slate-400">Ranked by marginal network recovery impact</span>
            </div>

            {recs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                <div className="text-lg">🎉 Network Stable</div>
                <p className="text-xs mt-1">No significant delays or cascade opportunities remaining.</p>
              </div>
            ) : (
              recs.map((rec, idx) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-cyan-400/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">{rec.title}</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                        Score +{Math.round(rec.gain)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-mono flex flex-wrap gap-x-3">
                      <span className="text-emerald-300 font-semibold">
                        {rec.deltaDelay >= 0 ? `-${fmtNumber(rec.deltaDelay)} min delay` : `+${fmtNumber(-rec.deltaDelay)} min delay`}
                      </span>
                      <span className="text-cyan-300 font-semibold">
                        +{fmtNumber(rec.deltaPax)} pax rescued
                      </span>
                      <span className="text-amber-300 font-semibold">
                        ₹{fmtMoney(rec.deltaCost)} saved
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1">{rec.risk}</div>
                  </div>

                  <button
                    className="btn btn-primary shrink-0 !px-4 !py-2 text-xs font-semibold"
                    onClick={() => {
                      applyAction(rec.action, rec.title);
                    }}
                  >
                    Apply Action →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-ink-950/80 px-6 py-3 text-xs text-slate-400">
          <span>AI Operations Engine · Real-time Causal Modeling</span>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
