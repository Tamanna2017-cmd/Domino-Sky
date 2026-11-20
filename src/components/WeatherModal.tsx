import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { formatTime } from '../engine/util';

export const WeatherModal = ({
  open,
  onClose,
  initialAirport,
}: {
  open: boolean;
  onClose: () => void;
  initialAirport?: string;
}) => {
  const dataset = useSimStore((s) => s.dataset);
  const addWeather = useSimStore((s) => s.addWeather);
  const clock = useSimStore((s) => s.clock);

  const [airport, setAirport] = useState(initialAirport || 'BOM');
  const [startTime, setStartTime] = useState(Math.round(clock / 15) * 15);
  const [duration, setDuration] = useState(90);
  const [severity, setSeverity] = useState<1 | 2 | 3>(3);
  const [diversions, setDiversions] = useState(true);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addWeather({
      id: `W-custom-${Date.now()}`,
      airport,
      startTime,
      duration,
      severity,
      diversions,
      label: `${airport} Severe Convective Cell`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/40 bg-ink-900 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-base">
              ⚡
            </span>
            <div>
              <h3 className="font-bold text-white text-sm">TRIGGER WEATHER DISRUPTION</h3>
              <p className="text-[10px] text-slate-400">Spawn localized storm or ground stop</p>
            </div>
          </div>
          <button className="btn !px-2 !py-1 text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Airport Select */}
          <div>
            <label className="label mb-1.5 block">Target Airport</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-ink-950 p-2 text-white font-medium"
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
            >
              {dataset.airports.map((ap) => (
                <option key={ap.code} value={ap.code}>
                  {ap.code} — {ap.name} ({ap.city})
                </option>
              ))}
            </select>
          </div>

          {/* Severity Level */}
          <div>
            <label className="label mb-1.5 block">Disruption Severity</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`rounded-lg border p-2 text-left transition-all ${
                  severity === 1
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-white/[0.02] text-slate-400'
                }`}
                onClick={() => setSeverity(1)}
              >
                <div className="font-bold">Sev 1: Slowdown</div>
                <div className="text-[9px] mt-0.5 opacity-80">Slot delays (50% cap)</div>
              </button>

              <button
                type="button"
                className={`rounded-lg border p-2 text-left transition-all ${
                  severity === 2
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-white/[0.02] text-slate-400'
                }`}
                onClick={() => setSeverity(2)}
              >
                <div className="font-bold">Sev 2: Ground Stop</div>
                <div className="text-[9px] mt-0.5 opacity-80">No departures take off</div>
              </button>

              <button
                type="button"
                className={`rounded-lg border p-2 text-left transition-all ${
                  severity === 3
                    ? 'border-rose-400 bg-rose-500/20 text-rose-200 shadow-glow'
                    : 'border-white/10 bg-white/[0.02] text-slate-400'
                }`}
                onClick={() => setSeverity(3)}
              >
                <div className="font-bold">Sev 3: Full Closure</div>
                <div className="text-[9px] mt-0.5 opacity-80">Arrivals divert/hold</div>
              </button>
            </div>
          </div>

          {/* Start Time */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="label">Start Time</span>
              <span className="font-mono font-bold text-cyan-300">{formatTime(startTime)}</span>
            </div>
            <input
              type="range"
              min="300"
              max="1380"
              step="15"
              className="w-full"
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
            />
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="label">Duration (Minutes)</span>
              <span className="font-mono font-bold text-amber-300">{duration} min</span>
            </div>
            <input
              type="range"
              min="15"
              max="240"
              step="15"
              className="w-full"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          {/* Diversions toggle if severity 3 */}
          {severity === 3 && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={diversions}
                onChange={(e) => setDiversions(e.target.checked)}
                className="rounded border-white/20 bg-ink-950 text-cyan-500"
              />
              <span className="text-slate-300 text-[11px]">Divert incoming flights to nearest alternate airport</span>
            </label>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger font-semibold">
              Trigger Storm Cell →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
