import { useSimStore } from '../store/useSimStore';
import { SCENARIOS } from '../data/scenarios';
import { OFFICIAL_DATASET } from '../data/officialDataset';
import { SYNTHETIC_DATASET } from '../data/synthetic';
import { formatTime } from '../engine/util';

export const Navbar = ({
  onOpenAdvisor,
  onOpenLoadData,
  onOpenHowItWorks,
  onOpenSettings,
  onOpenReport,
}: {
  onOpenAdvisor: () => void;
  onOpenLoadData: () => void;
  onOpenHowItWorks: () => void;
  onOpenSettings: () => void;
  onOpenReport: () => void;
}) => {
  const clock = useSimStore((s) => s.clock);
  const setClock = useSimStore((s) => s.setClock);
  const playing = useSimStore((s) => s.playing);
  const togglePlay = useSimStore((s) => s.togglePlay);
  const speed = useSimStore((s) => s.speed);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const view = useSimStore((s) => s.view);
  const setView = useSimStore((s) => s.setView);
  const scenarioId = useSimStore((s) => s.scenarioId);
  const loadScenario = useSimStore((s) => s.loadScenario);
  const dataset = useSimStore((s) => s.dataset);
  const loadDataset = useSimStore((s) => s.loadDataset);
  const dayEnd = useSimStore((s) => s.dayEnd);

  const isOfficial = dataset.label.includes('Official');

  return (
    <header className="flex h-14 w-full select-none items-center justify-between border-b border-white/10 bg-ink-950 px-4 text-xs">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-lg shadow-glow">
          ✈
        </div>
        <div>
          <div className="font-mono text-sm font-black tracking-widest text-white flex items-center gap-2">
            <span>DOMINO SKY</span>
            <span className="rounded bg-cyan-400/15 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-400/30">
              SIMULATOR
            </span>
          </div>
          <div className="text-[10px] text-slate-400">Flight Disruption Cascade & Recovery</div>
        </div>

        {/* Dataset Toggle */}
        <div className="hidden lg:flex items-center ml-4 pl-4 border-l border-white/10">
          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11px] font-medium text-cyan-200"
            value={isOfficial ? 'official' : 'synthetic'}
            onChange={(e) => {
              if (e.target.value === 'official') loadDataset(OFFICIAL_DATASET);
              else loadDataset(SYNTHETIC_DATASET);
            }}
          >
            <option value="official">Official Dataset (68 flt · 16 tails · 21 cx)</option>
            <option value="synthetic">Dense Synthetic Fleet (148 flt · 25 tails)</option>
          </select>
        </div>

        {/* Scenario Preset Selector */}
        <div className="hidden md:flex items-center ml-2">
          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11px] font-medium text-white"
            value={scenarioId}
            onChange={(e) => loadScenario(e.target.value)}
          >
            {SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulation Clock Controls & Scrubber */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          className={`btn !h-8 !w-8 !p-0 rounded-lg text-sm font-bold ${
            playing ? 'btn-amber' : 'btn-primary'
          }`}
          onClick={togglePlay}
          title={playing ? 'Pause simulation (Space)' : 'Play simulation (Space)'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Clock Digits Readout */}
        <div className="flex flex-col items-center font-mono">
          <div className="text-sm font-bold text-cyan-300 tracking-wider">
            {formatTime(clock)} <span className="text-[9px] text-slate-400">IST</span>
          </div>
        </div>

        {/* Time Slider Scrubber */}
        <div className="hidden sm:flex w-36 md:w-52 items-center">
          <input
            type="range"
            min="300"
            max={dayEnd}
            step="5"
            className="w-full cursor-pointer"
            value={clock}
            onChange={(e) => setClock(Number(e.target.value))}
          />
        </div>

        {/* Speed Multipliers */}
        <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {[1, 5, 20, 60].map((s) => (
            <button
              key={s}
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold transition-all ${
                speed === s
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* View Switcher & Action Modals */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          <button
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
              view === 'map'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setView('map')}
          >
            🗺️ Map
          </button>
          <button
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
              view === 'timeline'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setView('timeline' as any)}
          >
            📊 Gantt
          </button>
          <button
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
              view === 'network'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-glow'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setView('network')}
          >
            🕸️ Graph
          </button>
        </div>

        {/* Smart Advisor Launcher Button */}
        <button
          className="btn btn-primary !py-1 !px-2.5 !text-xs font-bold flex items-center gap-1.5 shadow-glow"
          onClick={onOpenAdvisor}
        >
          <span>🤖</span>
          <span className="hidden md:inline">Advisor</span>
        </button>

        {/* Load Data */}
        <button className="btn !py-1 !px-2" onClick={onOpenLoadData} title="Import CSV / JSON">
          📂 <span className="hidden xl:inline">Load Data</span>
        </button>

        {/* How it works */}
        <button className="btn !py-1 !px-2" onClick={onOpenHowItWorks} title="How it works">
          🧠 <span className="hidden xl:inline">Explain</span>
        </button>

        {/* Settings */}
        <button className="btn !py-1 !px-2" onClick={onOpenSettings} title="Settings & Assumptions">
          ⚙️
        </button>

        {/* Report Screen */}
        <button
          className="btn btn-amber !py-1 !px-2.5 !text-xs font-bold"
          onClick={onOpenReport}
          title="Incident Report & Scorecard"
        >
          📄 <span className="hidden md:inline">Report</span>
        </button>
      </div>
    </header>
  );
};
