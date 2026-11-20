import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { SCENARIOS } from '../data/scenarios';
import { formatTime } from '../engine/util';

export const ControlPanel = ({
  onOpenWeatherModal,
}: {
  onOpenWeatherModal: () => void;
}) => {
  const dataset = useSimStore((s) => s.dataset);
  const sim = useSimStore((s) => s.sim);
  const weather = useSimStore((s) => s.weather);
  const actions = useSimStore((s) => s.actions);
  const past = useSimStore((s) => s.past);
  const future = useSimStore((s) => s.future);
  const scenarioId = useSimStore((s) => s.scenarioId);

  const loadScenario = useSimStore((s) => s.loadScenario);
  const removeWeather = useSimStore((s) => s.removeWeather);
  const randomise = useSimStore((s) => s.randomise);
  const applyAction = useSimStore((s) => s.applyAction);
  const undo = useSimStore((s) => s.undo);
  const redo = useSimStore((s) => s.redo);
  const resetActions = useSimStore((s) => s.resetActions);
  const selectedFlightId = useSimStore((s) => s.selectedFlightId);

  // Tab for recovery levers
  const [activeTab, setActiveTab] = useState<'triggers' | 'levers' | 'history'>('levers');

  // Form states for manual levers
  const [swapFlightA, setSwapFlightA] = useState('');
  const [swapFlightB, setSwapFlightB] = useState('');
  const [cancelFlightId, setCancelFlightId] = useState('');
  const [holdFlightId, setHoldFlightId] = useState('');
  const [holdMinutes, setHoldMinutes] = useState(30);
  const [spareFlightId, setSpareFlightId] = useState('');
  const [spareTailId, setSpareTailId] = useState('');
  const [retimeFlightId, setRetimeFlightId] = useState('');
  const [retimeMinutes, setRetimeMinutes] = useState(-30);

  // Find standby aircraft available
  const standbyAircraft = dataset.aircraft.filter((a) => a.standby);

  // When a flight is selected on map/timeline, prefill relevant action forms
  if (selectedFlightId && selectedFlightId !== cancelFlightId) {
    if (!cancelFlightId) setCancelFlightId(selectedFlightId);
    if (!holdFlightId) setHoldFlightId(selectedFlightId);
    if (!spareFlightId) setSpareFlightId(selectedFlightId);
    if (!retimeFlightId) setRetimeFlightId(selectedFlightId);
  }

  // Handle Aircraft Swap
  const handleSwap = () => {
    if (!swapFlightA || !swapFlightB || swapFlightA === swapFlightB) return;
    const fA = dataset.flights.find((f) => f.id === swapFlightA);
    const fB = dataset.flights.find((f) => f.id === swapFlightB);
    if (!fA || !fB) return;

    applyAction(
      {
        type: 'swap',
        flightId: swapFlightA,
        otherFlightId: swapFlightB,
        note: `Swapped tails between ${fA.flightNo} and ${fB.flightNo}`,
      },
      `Swapped ${fA.flightNo} ↔ ${fB.flightNo}`,
    );
    setSwapFlightA('');
    setSwapFlightB('');
  };

  // Handle Cancel to Recover
  const handleCancel = () => {
    if (!cancelFlightId) return;
    const f = dataset.flights.find((x) => x.id === cancelFlightId);
    if (!f) return;

    applyAction(
      {
        type: 'cancel',
        flightId: cancelFlightId,
        note: `Pre-emptively cancelled ${f.flightNo} to protect downstream chain`,
      },
      `Cancelled ${f.flightNo} to recover chain`,
    );
    setCancelFlightId('');
  };

  // Handle Hold Connection
  const handleHold = () => {
    if (!holdFlightId) return;
    const f = dataset.flights.find((x) => x.id === holdFlightId);
    if (!f) return;

    applyAction(
      {
        type: 'hold',
        flightId: holdFlightId,
        minutes: holdMinutes,
        note: `Held ${f.flightNo} for ${holdMinutes} min for inbound connecting passengers`,
      },
      `Held ${f.flightNo} (+${holdMinutes}m) for connections`,
    );
  };

  // Handle Deploy Spare
  const handleSpare = () => {
    if (!spareFlightId || !spareTailId) return;
    const f = dataset.flights.find((x) => x.id === spareFlightId);
    if (!f) return;

    applyAction(
      {
        type: 'spare',
        flightId: spareFlightId,
        spareTailId: spareTailId,
        note: `Assigned spare standby aircraft ${spareTailId} to flight ${f.flightNo}`,
      },
      `Deployed standby ${spareTailId} for ${f.flightNo}`,
    );
    setSpareFlightId('');
    setSpareTailId('');
  };

  // Handle Pre-emptive Retiming
  const handleRetime = () => {
    if (!retimeFlightId) return;
    const f = dataset.flights.find((x) => x.id === retimeFlightId);
    if (!f) return;

    applyAction(
      {
        type: 'retime',
        flightId: retimeFlightId,
        minutes: retimeMinutes,
        note: `Pre-emptively retimed ${f.flightNo} (${f.origin}→${f.dest}) by ${retimeMinutes} min`,
      },
      `Retimed ${f.flightNo} (${retimeMinutes > 0 ? '+' : ''}${retimeMinutes}m)`,
    );
  };

  // Handle Auto-Rebook
  const handleRebook = () => {
    applyAction(
      {
        type: 'rebook',
        note: 'Auto-rebooked stranded & misconnected passengers onto subsequent available seats',
      },
      'Passenger rebooking active',
    );
  };

  const isRebookingActive = actions.some((a) => a.type === 'rebook');

  return (
    <div className="flex h-full w-full flex-col select-none overflow-hidden border-r border-white/5 bg-ink-900/90 backdrop-blur-xl">
      {/* Sidebar Navigation Tabs */}
      <div className="grid grid-cols-3 border-b border-white/10 bg-ink-950/60 p-1 text-[11px] font-semibold">
        <button
          className={`rounded-lg py-1.5 transition-all ${
            activeTab === 'levers'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-glow'
              : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('levers')}
        >
          Recovery Levers
        </button>
        <button
          className={`rounded-lg py-1.5 transition-all ${
            activeTab === 'triggers'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-glow'
              : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('triggers')}
        >
          Weather ({weather.length})
        </button>
        <button
          className={`rounded-lg py-1.5 transition-all ${
            activeTab === 'history'
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shadow-glow'
              : 'text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('history')}
        >
          Decisions ({actions.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-thin space-y-5">
        {/* TAB 1: RECOVERY LEVERS */}
        {activeTab === 'levers' && (
          <div className="space-y-4">
            {/* Header info */}
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Operations Levers</span>
                <span className="text-[10px] text-cyan-400 font-mono">LIVE CASCADE ENGINE</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Apply real-world operational tactics to arrest delay propagation down tail chains.
              </p>
            </div>

            {/* Quick One-Click Actions: Rebook Stranded */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>💺 Passenger Auto-Rebooking</span>
                    {isRebookingActive && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] text-emerald-300 border border-emerald-500/40">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Rebook misconnected pax on subsequent flights with empty capacity.
                  </div>
                </div>
                <button
                  className={`btn !py-1 !px-2.5 !text-xs ${
                    isRebookingActive ? 'btn-danger' : 'btn-primary'
                  }`}
                  onClick={handleRebook}
                  disabled={isRebookingActive}
                >
                  {isRebookingActive ? 'Rebooked' : 'Activate'}
                </button>
              </div>
            </div>

            {/* Lever 1: Aircraft Swap */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">🔄 Aircraft Rotation Swap</span>
                <span className="text-[10px] text-slate-400">Same station only</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Swap tail assignments between two flights departing the same airport to shield an onward international or heavy connection bank.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Delayed Flight A</label>
                  <select
                    className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                    value={swapFlightA}
                    onChange={(e) => setSwapFlightA(e.target.value)}
                  >
                    <option value="">Select flight...</option>
                    {dataset.flights.map((f) => {
                      const out = sim.outcomes[f.id];
                      return (
                        <option key={`sw-a-${f.id}`} value={f.id}>
                          {f.flightNo} ({f.origin}→{f.dest}) {out?.arrDelay ? `+${out.arrDelay}m` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Partner Flight B</label>
                  <select
                    className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                    value={swapFlightB}
                    onChange={(e) => setSwapFlightB(e.target.value)}
                  >
                    <option value="">Select flight...</option>
                    {dataset.flights.map((f) => (
                      <option key={`sw-b-${f.id}`} value={f.id}>
                        {f.flightNo} ({f.origin}→{f.dest})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="btn btn-primary w-full !py-1.5"
                onClick={handleSwap}
                disabled={!swapFlightA || !swapFlightB || swapFlightA === swapFlightB}
              >
                Execute Swap
              </button>
            </div>

            {/* Lever 2: Cancel to Recover */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-300">🛑 Cancel Leg to Recover Chain</span>
                <span className="text-[10px] text-rose-400 font-mono">CIRCUIT BREAKER</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Sacrifice one heavily delayed leg so the physical aircraft resets position and downstream flights run on schedule.
              </p>
              <div>
                <select
                  className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                  value={cancelFlightId}
                  onChange={(e) => setCancelFlightId(e.target.value)}
                >
                  <option value="">Select flight to cancel...</option>
                  {dataset.flights.map((f) => {
                    const out = sim.outcomes[f.id];
                    return (
                      <option key={`can-${f.id}`} value={f.id}>
                        {f.flightNo} ({f.origin}→{f.dest}) · {f.pax} pax · {out?.arrDelay ? `+${out.arrDelay}m late` : 'on-time'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                className="btn btn-danger w-full !py-1.5"
                onClick={handleCancel}
                disabled={!cancelFlightId}
              >
                Cancel Leg to Reset Tail
              </button>
            </div>

            {/* Lever 3: Hold Connection */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300">⏱️ Hold for Inbound Connections</span>
                <span className="text-[10px] text-amber-400 font-mono">CONNECTION PROTECTOR</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Hold a departure to allow transfer passengers from an inbound late flight to make their layover.
              </p>
              <div>
                <select
                  className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                  value={holdFlightId}
                  onChange={(e) => setHoldFlightId(e.target.value)}
                >
                  <option value="">Select flight to hold...</option>
                  {dataset.flights.map((f) => (
                    <option key={`hold-${f.id}`} value={f.id}>
                      {f.flightNo} ({f.origin}→{f.dest}) - dep {formatTime(f.schedDep)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>Hold Duration:</span>
                  <span className="font-mono font-bold text-amber-300">{holdMinutes} minutes</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  className="w-full"
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(Number(e.target.value))}
                />
              </div>
              <button
                className="btn btn-amber w-full !py-1.5"
                onClick={handleHold}
                disabled={!holdFlightId}
              >
                Apply Connection Hold
              </button>
            </div>

            {/* Lever 4: Standby Spare Aircraft */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-300">✈️ Deploy Standby Aircraft</span>
                <span className="text-[10px] text-emerald-400 font-mono">SPARE METAL</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Deploy a hot spare aircraft from a hub base (e.g. VT-DS17 at BLR, VT-DS18 at DEL) to cover a stranded chain.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Target Flight</label>
                  <select
                    className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                    value={spareFlightId}
                    onChange={(e) => setSpareFlightId(e.target.value)}
                  >
                    <option value="">Select flight...</option>
                    {dataset.flights.map((f) => {
                      const out = sim.outcomes[f.id];
                      return (
                        <option key={`spr-f-${f.id}`} value={f.id}>
                          {f.flightNo} ({f.origin}→{f.dest}) {out?.arrDelay ? `+${out.arrDelay}m late` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Standby Tail</label>
                  <select
                    className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                    value={spareTailId}
                    onChange={(e) => setSpareTailId(e.target.value)}
                  >
                    <option value="">Select standby tail...</option>
                    {standbyAircraft.map((sp) => (
                      <option key={`sp-${sp.tailId}`} value={sp.tailId}>
                        {sp.tailId} (Base {sp.base})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="btn btn-primary w-full !py-1.5"
                onClick={handleSpare}
                disabled={!spareFlightId || !spareTailId}
              >
                Deploy Spare Aircraft
              </button>
            </div>

            {/* Lever 5: Pre-emptive Retiming */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cyan-300">⚡ Pre-emptive Retiming</span>
                <span className="text-[10px] text-cyan-400 font-mono">STORM ESCAPE</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Shift a flight earlier (or later) ahead of a forecast storm cell so it escapes ground stop windows.
              </p>
              <div>
                <select
                  aria-label="Select flight to retime"
                  className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-xs text-white"
                  value={retimeFlightId}
                  onChange={(e) => setRetimeFlightId(e.target.value)}
                >
                  <option value="">Select flight to retime...</option>
                  {dataset.flights.map((f) => {
                    const out = sim.outcomes[f.id];
                    return (
                      <option key={`rt-${f.id}`} value={f.id}>
                        {f.flightNo} ({f.origin}→{f.dest}) · STD {formatTime(f.schedDep)} {out?.arrDelay ? `(+${out.arrDelay}m)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>Retime Adjustment:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {retimeMinutes > 0 ? `+${retimeMinutes}` : retimeMinutes} minutes
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Retime adjustment minutes"
                  min="-60"
                  max="60"
                  step="15"
                  className="w-full"
                  value={retimeMinutes}
                  onChange={(e) => setRetimeMinutes(Number(e.target.value))}
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>-60m (Depart Early)</span>
                  <span>0m</span>
                  <span>+60m (Push Later)</span>
                </div>
              </div>
              <button
                className="btn btn-primary w-full !py-1.5"
                onClick={handleRetime}
                disabled={!retimeFlightId || retimeMinutes === 0}
              >
                Apply Retiming
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: WEATHER TRIGGERS & PRESETS */}
        {activeTab === 'triggers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Disruption Scenarios</h3>
                <p className="text-[11px] text-slate-400">Trigger atmospheric cells to watch domino propagation.</p>
              </div>
              <button className="btn btn-primary !py-1 !px-2.5 !text-xs" onClick={onOpenWeatherModal}>
                + Custom Storm
              </button>
            </div>

            {/* Scenario Presets */}
            <div className="space-y-2">
              {SCENARIOS.map((sc) => {
                const isCurrent = scenarioId === sc.id;
                return (
                  <div
                    key={sc.id}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      isCurrent
                        ? 'border-cyan-400/50 bg-cyan-950/30 shadow-glow'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                    onClick={() => loadScenario(sc.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{sc.name}</span>
                      <span className="text-[10px] font-mono text-cyan-300">{sc.tagline}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{sc.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Random Chaos Button */}
            <button className="btn btn-amber w-full !py-2 font-bold" onClick={randomise}>
              🎲 Roll Random Multi-Airport Chaos
            </button>

            {/* Active Weather Cells List */}
            <div className="space-y-2 pt-2">
              <span className="label">Active Storm Cells ({weather.length})</span>
              {weather.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                  Sky clear across India. No weather disruptions.
                </div>
              ) : (
                weather.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5"
                  >
                    <div>
                      <div className="font-mono font-bold text-rose-300">
                        {ev.airport} · {ev.severity === 3 ? 'Full Closure' : ev.severity === 2 ? 'Ground Stop' : 'Capacity Cut'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Starts {formatTime(ev.startTime)} · Duration {ev.duration} min
                      </div>
                    </div>
                    <button
                      className="btn !py-1 !px-2 text-[10px] text-rose-400 hover:text-white"
                      onClick={() => removeWeather(ev.id)}
                    >
                      Clear
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DECISION HISTORY & AUDIT */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Decision History</h3>
                <p className="text-[11px] text-slate-400">Full audit log of controller interventions.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="btn !py-1 !px-2 text-[10px]"
                  onClick={undo}
                  disabled={past.length === 0}
                  title="Undo last action"
                >
                  ↩ Undo
                </button>
                <button
                  className="btn !py-1 !px-2 text-[10px]"
                  onClick={redo}
                  disabled={future.length === 0}
                  title="Redo action"
                >
                  ↪ Redo
                </button>
              </div>
            </div>

            {/* List of Applied Actions */}
            {actions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
                No recovery actions applied yet. The network is running baseline.
              </div>
            ) : (
              <div className="space-y-2">
                {actions.map((act, i) => (
                  <div
                    key={act.id}
                    className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-cyan-200 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-500">#{i + 1}</span>
                        <span className="uppercase">{act.type}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">{act.note || act.type}</div>
                    </div>
                  </div>
                ))}

                <button
                  className="btn btn-danger w-full !py-1.5 mt-2 text-xs"
                  onClick={resetActions}
                >
                  Clear All Actions (Reset to Baseline)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
