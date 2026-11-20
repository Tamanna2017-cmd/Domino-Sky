import { useSimStore } from '../store/useSimStore';

export const TourGuide = () => {
  const tourStep = useSimStore((s) => s.tourStep);
  const setTourStep = useSimStore((s) => s.setTourStep);
  const setView = useSimStore((s) => s.setView);

  if (tourStep === 0) return null;

  const nextStep = () => {
    if (tourStep === 1) {
      setView('map');
      setTourStep(2);
    } else if (tourStep === 2) {
      setView('network');
      setTourStep(3);
    } else {
      setTourStep(0);
    }
  };

  const prevStep = () => {
    if (tourStep > 1) setTourStep(tourStep - 1);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl border border-cyan-400/50 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl text-xs select-none">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-bold text-cyan-300">
            {tourStep}
          </span>
          <span className="font-bold text-white text-xs uppercase tracking-wider">
            JUDGES GUIDED TOUR
          </span>
        </div>
        <button
          className="text-slate-400 hover:text-white text-xs"
          onClick={() => setTourStep(0)}
        >
          ✕ Dismiss
        </button>
      </div>

      <div className="py-3">
        {tourStep === 1 && (
          <div className="space-y-1.5">
            <h4 className="font-bold text-cyan-200">1. Trigger the Disruption</h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Click any airport on the map to trigger a thunderstorm or ground stop, or pick the preset{' '}
              <strong className="text-white">"Mumbai Monsoon Storm"</strong>. Watch the shockwave pulse out from BOM.
            </p>
          </div>
        )}

        {tourStep === 2 && (
          <div className="space-y-1.5">
            <h4 className="font-bold text-amber-200">2. Observe the Domino Cascade</h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Aircraft fly continuous rotations. When one plane is delayed at Mumbai, every subsequent leg on its tail arrives late. Click any delayed flight to inspect its{' '}
              <strong className="text-white">Causal Graph</strong> and see how it broke connections.
            </p>
          </div>
        )}

        {tourStep === 3 && (
          <div className="space-y-1.5">
            <h4 className="font-bold text-emerald-200">3. Execute Recovery & AI Advisor</h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Test operational interventions: <strong className="text-white">Swap aircraft</strong>, <strong className="text-white">Deploy standby metal</strong>, or click{' '}
              <strong className="text-white">"Smart Advisor"</strong> to let the AI score and auto-optimize the network!
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
        <div className="flex gap-1">
          <span className={`h-1.5 w-6 rounded-full ${tourStep === 1 ? 'bg-cyan-400' : 'bg-white/20'}`} />
          <span className={`h-1.5 w-6 rounded-full ${tourStep === 2 ? 'bg-cyan-400' : 'bg-white/20'}`} />
          <span className={`h-1.5 w-6 rounded-full ${tourStep === 3 ? 'bg-cyan-400' : 'bg-white/20'}`} />
        </div>

        <div className="flex items-center gap-2">
          {tourStep > 1 && (
            <button className="btn !py-1 !px-2" onClick={prevStep}>
              Back
            </button>
          )}
          <button className="btn btn-primary !py-1 !px-3 font-semibold" onClick={nextStep}>
            {tourStep === 3 ? 'Finish Tour ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};
