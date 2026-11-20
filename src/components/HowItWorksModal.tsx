export const HowItWorksModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-base">
              🧠
            </span>
            <div>
              <h2 className="text-base font-bold text-white">HOW IT WORKS — ROTATIONAL DOMINO ENGINE</h2>
              <p className="text-[11px] text-slate-400">
                Why a 90-minute storm at Mumbai disrupts Bengaluru 5 hours later
              </p>
            </div>
          </div>
          <button className="btn !px-2.5 !py-1 text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-thin space-y-6">
          {/* Animated Mini Diagram: Falling Dominoes */}
          <div className="rounded-xl border border-cyan-500/30 bg-ink-950 p-4">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-3">
              The Domino Mechanics Visualized
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-rose-950/30 border border-rose-500/40 min-w-[110px]">
                <div className="text-xl">⛈️</div>
                <div className="font-bold text-rose-300 text-[11px] mt-1">1. Mumbai Storm</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">BOM closed 90 min</div>
              </div>

              <div className="text-rose-400 font-bold text-lg">➔</div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-amber-950/30 border border-amber-500/40 min-w-[110px]">
                <div className="text-xl">✈️</div>
                <div className="font-bold text-amber-300 text-[11px] mt-1">2. VT-DS04 Held</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">Lands late at PNQ</div>
              </div>

              <div className="text-amber-400 font-bold text-lg">➔</div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-amber-950/30 border border-amber-500/40 min-w-[110px]">
                <div className="text-xl">☀️</div>
                <div className="font-bold text-amber-300 text-[11px] mt-1">3. Sunny Pune Delay</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">Departs 70m late</div>
              </div>

              <div className="text-amber-400 font-bold text-lg">➔</div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-purple-950/30 border border-purple-500/40 min-w-[110px]">
                <div className="text-xl">👥</div>
                <div className="font-bold text-purple-300 text-[11px] mt-1">4. Broken Layover</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">43 pax miss connect</div>
              </div>
            </div>
          </div>

          {/* Section 1: Tail Chains */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-300">
              1. Aircraft Rotations (Tail Chains)
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              A commercial aircraft does not fly once a day. A single Boeing 737 or Airbus A320 operates{' '}
              <strong className="text-white">4 to 7 chained legs</strong> from 06:00 until midnight. Flight N+1 cannot take off until the aircraft has landed from Flight N and undergone passenger deplaning, cleaning, refueling, and boarding (minimum turnaround time, typically 35–45 minutes).
            </p>
          </div>

          {/* Section 2: Mathematical Propagation Rule */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-300">
              2. Simulation Departure Equation
            </h3>
            <div className="rounded-lg border border-white/10 bg-ink-950 p-3 font-mono text-[10.5px] text-cyan-200">
              actualDep = max(
                schedDep,
                inboundArrival + minTurnaround,
                airportOpenTime,
                slotQueueTime
              )
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] mt-1">
              If an aircraft arrives late, the turnaround buffer is eaten. If the delay exceeds the buffer, the subsequent departure is forcibly pushed, even if that departure airport has crystal-clear blue skies!
            </p>
          </div>

          {/* Section 3: Passenger Connections */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-300">
              3. Broken Passenger Connections
            </h3>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Modern hub-and-spoke networks rely on passenger transfers. If Flight A arrives too late for passengers to reach connecting Flight B before departure (minimum connecting time 45 min), the connection breaks. Those passengers become stranded and require hotel vouchers, compensation, and rebooking on future flights.
            </p>
          </div>

          {/* Section 4: Recovery Levers */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-300">
              4. Recovery Levers Explained
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="font-bold text-white">🔄 Aircraft Swap:</span> Swap tail assignments between an on-time aircraft and a late aircraft at the same station to protect high-impact onward banks.
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="font-bold text-rose-300">🛑 Cancel to Recover:</span> Sacrifice a single leg to reset the physical tail and run the remaining 4 legs on-time.
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="font-bold text-amber-300">⏱️ Hold Connection:</span> Hold departing flight up to 30 min so connecting passengers make their flight.
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="font-bold text-emerald-300">✈️ Standby Spare:</span> Inject standby metal (VT-DS17 or VT-DS18) into the schedule to replace delayed aircraft.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-white/10 bg-ink-950/80 px-6 py-3">
          <button className="btn btn-primary" onClick={onClose}>
            Got it, back to simulator →
          </button>
        </div>
      </div>
    </div>
  );
};
