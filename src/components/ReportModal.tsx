import { useSimStore } from '../store/useSimStore';
import { recoveryScore, gradeOf } from '../engine/advisor';
import { fmtMoney, fmtNumber } from '../engine/util';

export const ReportModal = ({
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
  const scenarioId = useSimStore((s) => s.scenarioId);

  if (!open) return null;

  const cur = sim.metrics;
  const base = baseline.metrics;
  const score = recoveryScore(cur, base);
  const grade = gradeOf(score);

  const delaySaved = Math.max(0, base.totalDelayMin - cur.totalDelayMin);
  const paxRescued = Math.max(0, base.paxStranded - cur.paxStranded);
  const costAvoided = Math.max(0, base.estimatedCost - cur.estimatedCost);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
      title: 'Domino Sky Operations Incident & Recovery Report',
      timestamp: new Date().toISOString(),
      scenario: scenarioId,
      dataset: dataset.label,
      weatherDisruptions: weather,
      decisions: actions,
      score: { score, grade: grade.grade, summary: grade.blurb },
      kpis: {
        baseline: base,
        current: cur,
        savings: { delaySaved, paxRescued, costAvoided },
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domino_sky_report_${scenarioId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none print:p-0 print:bg-white">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden text-xs print:border-none print:bg-white print:text-black print:max-h-none print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-8 py-5 print:border-b-2 print:border-black print:bg-white">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-cyan-400 print:text-black">
              Executive Incident & Recovery Briefing
            </div>
            <h1 className="text-xl font-bold text-white print:text-black">
              DOMINO SKY — NETWORK RECOVERY REPORT
            </h1>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨️ Print / Save PDF
            </button>
            <button className="btn" onClick={handleExportJson}>
              📥 Download JSON
            </button>
            <button className="btn !px-2.5 !py-1 text-slate-400 hover:text-white" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Report Document Content */}
        <div className="flex-1 overflow-y-auto p-8 scroll-thin space-y-6 print:overflow-visible">
          {/* Executive Score & Evaluation Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 print:border print:border-gray-300">
            <div className="flex items-center gap-5">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl font-black shadow-lg"
                style={{
                  backgroundColor: `${grade.color}25`,
                  color: grade.color,
                  border: `2px solid ${grade.color}`,
                }}
              >
                {grade.grade}
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400 print:text-gray-600">
                  Operations Recovery Grade
                </div>
                <div className="text-2xl font-black text-white font-mono print:text-black">
                  {score} / 100 Score
                </div>
                <div className="text-sm text-cyan-200 mt-1 print:text-gray-800 font-medium">
                  {grade.blurb}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center sm:text-right">
              <div>
                <div className="text-[10px] text-slate-400 print:text-gray-500 uppercase">Delay Saved</div>
                <div className="font-mono text-lg font-bold text-emerald-400 print:text-black">
                  -{fmtNumber(delaySaved)}m
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 print:text-gray-500 uppercase">Pax Rescued</div>
                <div className="font-mono text-lg font-bold text-cyan-400 print:text-black">
                  +{fmtNumber(paxRescued)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 print:text-gray-500 uppercase">Cost Avoided</div>
                <div className="font-mono text-lg font-bold text-amber-400 print:text-black">
                  ₹{fmtMoney(costAvoided)}
                </div>
              </div>
            </div>
          </div>

          {/* Before vs After Performance Matrix */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider print:text-black">
              1. Performance Delta (Baseline vs Recovered)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/10 print:border-gray-300">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-ink-950 text-slate-400 border-b border-white/10 print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-3">KEY PERFORMANCE INDICATOR</th>
                    <th className="p-3 text-right">DO-NOTHING BASELINE</th>
                    <th className="p-3 text-right">WITH RECOVERY ACTIONS</th>
                    <th className="p-3 text-right">OPERATIONAL DELTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-gray-200 text-slate-300 print:text-black">
                  <tr>
                    <td className="p-3">Total Network Delay Minutes</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">{fmtNumber(base.totalDelayMin)} min</td>
                    <td className="p-3 text-right text-emerald-400 print:text-black font-bold">{fmtNumber(cur.totalDelayMin)} min</td>
                    <td className="p-3 text-right text-emerald-300 font-bold">-{fmtNumber(delaySaved)} min</td>
                  </tr>
                  <tr>
                    <td className="p-3">Delayed Flights (&gt;15 min)</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">{base.flightsDelayed}</td>
                    <td className="p-3 text-right font-bold">{cur.flightsDelayed}</td>
                    <td className="p-3 text-right text-emerald-300 font-bold">
                      {cur.flightsDelayed - base.flightsDelayed}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3">Flights Cancelled</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">{base.flightsCancelled}</td>
                    <td className="p-3 text-right font-bold">{cur.flightsCancelled}</td>
                    <td className="p-3 text-right text-slate-400">
                      {cur.flightsCancelled - base.flightsCancelled}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3">Stranded / Misconnected Passengers</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">{fmtNumber(base.paxStranded)}</td>
                    <td className="p-3 text-right text-emerald-400 print:text-black font-bold">{fmtNumber(cur.paxStranded)}</td>
                    <td className="p-3 text-right text-emerald-300 font-bold">-{fmtNumber(paxRescued)}</td>
                  </tr>
                  <tr>
                    <td className="p-3">On-Time Arrival Performance (OTP)</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">{base.onTimePct.toFixed(1)}%</td>
                    <td className="p-3 text-right text-cyan-400 print:text-black font-bold">{cur.onTimePct.toFixed(1)}%</td>
                    <td className="p-3 text-right text-cyan-300 font-bold">+{(cur.onTimePct - base.onTimePct).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td className="p-3">Estimated Disruption Cost</td>
                    <td className="p-3 text-right text-rose-400 print:text-black">₹{fmtMoney(base.estimatedCost)}</td>
                    <td className="p-3 text-right text-amber-400 print:text-black font-bold">₹{fmtMoney(cur.estimatedCost)}</td>
                    <td className="p-3 text-right text-emerald-300 font-bold">-₹{fmtMoney(costAvoided)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Log of Applied Interventions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider print:text-black">
              2. Operations Log — Decisions Executed ({actions.length})
            </h3>
            {actions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-slate-500">
                No recovery actions were applied. Unmitigated cascade.
              </div>
            ) : (
              <div className="space-y-1.5">
                {actions.map((act, i) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-2.5 print:border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-cyan-400 font-bold">#{i + 1}</span>
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[9px] uppercase font-bold text-cyan-300 border border-cyan-500/30">
                        {act.type}
                      </span>
                      <span className="text-white print:text-black font-medium">{act.note || act.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-ink-950/80 px-8 py-4 no-print">
          <span className="text-slate-400">Domino Sky Operations Control Center</span>
          <button className="btn btn-primary" onClick={onClose}>
            Back to Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
