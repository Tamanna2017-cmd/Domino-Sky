import { useEffect, useState } from 'react';
import { useSimStore } from './store/useSimStore';
import { Navbar } from './components/Navbar';
import { ControlPanel } from './components/ControlPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { MapIndia } from './components/MapIndia';
import { TimelineGantt } from './components/TimelineGantt';
import { NetworkGraph } from './components/NetworkGraph';
import { SmartAdvisorModal } from './components/SmartAdvisorModal';
import { WeatherModal } from './components/WeatherModal';
import { LoadDataModal } from './components/LoadDataModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { TourGuide } from './components/TourGuide';
import { Toasts } from './components/Toasts';
import { Intro } from './components/Intro';

export const App = () => {
  const showIntro = useSimStore((s) => s.showIntro);
  const view = useSimStore((s) => s.view);
  const playing = useSimStore((s) => s.playing);
  const advance = useSimStore((s) => s.advance);
  const togglePlay = useSimStore((s) => s.togglePlay);
  const undo = useSimStore((s) => s.undo);
  const redo = useSimStore((s) => s.redo);
  const selectFlight = useSimStore((s) => s.selectFlight);
  const selectAirport = useSimStore((s) => s.selectAirport);
  const setView = useSimStore((s) => s.setView);

  // Modal display states
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [weatherAirport, setWeatherAirport] = useState<string | undefined>(undefined);
  const [showLoad, setShowLoad] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Left & Right drawer collapses for extra screen real estate
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Clock animation loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (playing) {
        advance(dt);
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, advance]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === '1') {
        setView('map');
      } else if (e.key === '2') {
        setView('timeline');
      } else if (e.key === '3') {
        setView('network');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        selectFlight(null);
        selectAirport(null);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, setView, undo, redo, selectFlight, selectAirport]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 font-sans text-slate-100 antialiased">
      {/* Intro Landing Hero Screen */}
      {showIntro ? (
        <Intro />
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Top Navigation & Simulation Time Bar */}
          <Navbar
            onOpenAdvisor={() => setShowAdvisor(true)}
            onOpenLoadData={() => setShowLoad(true)}
            onOpenHowItWorks={() => setShowHow(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenReport={() => setShowReport(true)}
          />

          {/* Main 3-Column Air Traffic Command Layout */}
          <div className="relative flex flex-1 overflow-hidden">
            {/* Left Control Panel (Levers & Triggers) */}
            <aside
              className={`relative z-20 flex shrink-0 flex-col transition-all duration-300 ${
                leftOpen ? 'w-80 lg:w-96' : 'w-0 overflow-hidden'
              }`}
            >
              <ControlPanel
                onOpenWeatherModal={() => {
                  setWeatherAirport(undefined);
                  setShowWeather(true);
                }}
              />
            </aside>

            {/* Left Drawer Toggle Button */}
            <button
              className="absolute left-2 top-2 z-30 rounded-lg border border-white/10 bg-ink-900/90 p-1.5 text-xs text-slate-400 hover:text-white shadow-lg backdrop-blur-md"
              style={{ left: leftOpen ? 'calc(24rem + 8px)' : '8px' }}
              onClick={() => setLeftOpen(!leftOpen)}
              title={leftOpen ? 'Collapse Left Panel' : 'Expand Left Panel'}
            >
              {leftOpen ? '◀' : '▶ Levers'}
            </button>

            {/* Center Stage: Map / Gantt / Network View */}
            <main className="relative flex flex-1 flex-col overflow-hidden bg-ink-950">
              {view === 'map' && (
                <MapIndia
                  onSelectAirport={(apCode) => {
                    setWeatherAirport(apCode);
                    setShowWeather(true);
                  }}
                />
              )}
              {view === 'timeline' && (
                <TimelineGantt
                  onOpenRecoveryAction={() => {
                    setLeftOpen(true);
                  }}
                />
              )}
              {view === 'network' && <NetworkGraph />}
            </main>

            {/* Right Drawer Toggle Button */}
            <button
              className="absolute right-2 top-2 z-30 rounded-lg border border-white/10 bg-ink-900/90 p-1.5 text-xs text-slate-400 hover:text-white shadow-lg backdrop-blur-md"
              style={{ right: rightOpen ? 'calc(24rem + 8px)' : '8px' }}
              onClick={() => setRightOpen(!rightOpen)}
              title={rightOpen ? 'Collapse Right Panel' : 'Expand Right Panel'}
            >
              {rightOpen ? '▶' : '◀ Health'}
            </button>

            {/* Right Insights Panel (Damage Meter & Causal Inspector) */}
            <aside
              className={`relative z-20 flex shrink-0 flex-col transition-all duration-300 ${
                rightOpen ? 'w-80 lg:w-96' : 'w-0 overflow-hidden'
              }`}
            >
              <InsightsPanel onOpenAdvisorModal={() => setShowAdvisor(true)} />
            </aside>
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      <SmartAdvisorModal open={showAdvisor} onClose={() => setShowAdvisor(false)} />
      <WeatherModal
        open={showWeather}
        onClose={() => setShowWeather(false)}
        initialAirport={weatherAirport}
      />
      <LoadDataModal open={showLoad} onClose={() => setShowLoad(false)} />
      <HowItWorksModal open={showHow} onClose={() => setShowHow(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ReportModal open={showReport} onClose={() => setShowReport(false)} />

      {/* Guided Tour for Judges */}
      <TourGuide />

      {/* Live Toast Notifications */}
      <Toasts />
    </div>
  );
};
