import { useSimStore } from '../store/useSimStore';
import { DEFAULT_SETTINGS } from '../engine/config';

export const SettingsModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const settings = useSimStore((s) => s.settings);
  const setSettings = useSimStore((s) => s.setSettings);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none text-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-base">
              ⚙️
            </span>
            <div>
              <h2 className="text-base font-bold text-white">SIMULATION ASSUMPTIONS</h2>
              <p className="text-[11px] text-slate-400">
                Operational buffer constraints and cost parameters
              </p>
            </div>
          </div>
          <button className="btn !px-2.5 !py-1 text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scroll-thin">
          {/* Operational Buffers */}
          <div className="space-y-3">
            <span className="label">Operational Buffer Rules</span>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">Minimum Ground Turnaround:</span>
                <span className="font-mono text-cyan-300 font-bold">{settings.minTurnaround} min</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                step="5"
                className="w-full"
                value={settings.minTurnaround}
                onChange={(e) => setSettings({ minTurnaround: Number(e.target.value) })}
              />
              <span className="text-[10px] text-slate-500">
                Time required between arrival and next departure for deplaning, servicing & boarding.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">Minimum Passenger Connection Time (MCT):</span>
                <span className="font-mono text-cyan-300 font-bold">{settings.minConnect} min</span>
              </div>
              <input
                type="range"
                min="25"
                max="75"
                step="5"
                className="w-full"
                value={settings.minConnect}
                onChange={(e) => setSettings({ minConnect: Number(e.target.value) })}
              />
              <span className="text-[10px] text-slate-500">
                Layover buffer below which passengers miss their onward connecting flight.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">Automatic Cancellation Delay Threshold:</span>
                <span className="font-mono text-rose-300 font-bold">{settings.cancelDelayThreshold} min</span>
              </div>
              <input
                type="range"
                min="120"
                max="360"
                step="30"
                className="w-full"
                value={settings.cancelDelayThreshold}
                onChange={(e) => setSettings({ cancelDelayThreshold: Number(e.target.value) })}
              />
              <span className="text-[10px] text-slate-500">
                Delays exceeding this limit result in an operational cancellation rule.
              </span>
            </div>
          </div>

          {/* Financial Cost Assumptions */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <span className="label">Cost Parameters (₹ INR)</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-300">Delay Cost / Min</label>
                <input
                  type="number"
                  className="w-full mt-1 rounded border border-white/10 bg-ink-950 p-1.5 font-mono text-white"
                  value={settings.delayCostPerMin}
                  onChange={(e) => setSettings({ delayCostPerMin: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300">Cancellation Base Cost</label>
                <input
                  type="number"
                  className="w-full mt-1 rounded border border-white/10 bg-ink-950 p-1.5 font-mono text-white"
                  value={settings.cancellationCost}
                  onChange={(e) => setSettings({ cancellationCost: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300">Stranding Hotel & Care / Pax</label>
                <input
                  type="number"
                  className="w-full mt-1 rounded border border-white/10 bg-ink-950 p-1.5 font-mono text-white"
                  value={settings.strandingCost}
                  onChange={(e) => setSettings({ strandingCost: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300">Misconnect Booking / Pax</label>
                <input
                  type="number"
                  className="w-full mt-1 rounded border border-white/10 bg-ink-950 p-1.5 font-mono text-white"
                  value={settings.misconnectCost}
                  onChange={(e) => setSettings({ misconnectCost: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-ink-950/80 px-6 py-3">
          <button
            className="btn !text-slate-400"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
          >
            Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
