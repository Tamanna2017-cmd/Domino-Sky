import { motion } from 'framer-motion';
import { useSimStore } from '../store/useSimStore';

const DOMINOES = [
  { x: 18, delay: 0.0 },
  { x: 60, delay: 0.18 },
  { x: 102, delay: 0.36 },
  { x: 144, delay: 0.54 },
  { x: 186, delay: 0.72 },
];

const STEPS = [
  {
    n: '01',
    title: 'Trigger a storm',
    text: 'Click any airport and set severity and duration. Mumbai at 14:00 for 90 minutes is the crowd-pleaser.',
  },
  {
    n: '02',
    title: 'Watch the dominoes',
    text: 'Delays race down each aircraft rotation. Click a late flight to trace its causal path back to the storm.',
  },
  {
    n: '03',
    title: 'Recover the network',
    text: 'Swap tails, hold connections, cancel a leg or deploy standby metal. The Smart Advisor ranks what to do next.',
  },
];

export const Intro = () => {
  const setShow = useSimStore((s) => s.setShow);
  const setTourStep = useSimStore((s) => s.setTourStep);
  const metrics = useSimStore((s) => s.sim.metrics);
  const baseline = useSimStore((s) => s.baseline.metrics);

  const launch = () => {
    setShow('showIntro', false);
    setTourStep(1);
  };

  return (
    <div className="relative grid h-full grid-cols-1 overflow-y-auto lg:grid-cols-[1.15fr_1fr]">
      <div className="grid-bg relative flex flex-col justify-center overflow-hidden px-8 py-12 lg:px-16">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-10 h-40 w-40 rounded-full bg-rose-500/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/10 text-lg shadow-glow">
              ✈
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                Domino Sky
              </div>
              <div className="text-[10px] text-slate-500">Flight disruption cascade & recovery simulator</div>
            </div>
          </div>

          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            One storm.
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-teal-200 to-amber-200 bg-clip-text text-transparent">
              A hundred late flights.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400">
            Aircraft fly rotations, not single flights. Close Mumbai for 90 minutes and a
            Bengaluru→Kolkata leg is still late five hours later — because the same tail is stuck.
            This is that cascade, made visible and recoverable.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary !px-5 !py-2.5 !text-sm" onClick={launch}>
              Launch simulator →
            </button>
            <button className="btn !px-4 !py-2.5 !text-sm" onClick={() => setShow('showHow', true)}>
              How it works
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-[11px] text-slate-500">
            <div>
              <span className="tnum text-lg font-semibold text-cyan-200">{metrics.flightsTotal}</span> flights
            </div>
            <div>
              <span className="tnum text-lg font-semibold text-cyan-200">{metrics.paxTotal.toLocaleString('en-IN')}</span> passengers
            </div>
            <div>
              <span className="tnum text-lg font-semibold text-amber-200">
                {metrics.maxCascadeDepth}
              </span>{' '}
              levels deep
            </div>
            <div>
              <span className="tnum text-lg font-semibold text-rose-200">
                {baseline.totalDelayMin.toLocaleString('en-IN')}
              </span>{' '}
              delay-min in the loaded storm
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative flex flex-col justify-center overflow-hidden border-t border-white/5 bg-black/25 px-8 py-12 lg:border-l lg:border-t-0 lg:px-12">
        <div className="relative mx-auto h-40 w-full max-w-sm">
          {DOMINOES.map((d, i) => (
            <motion.div
              key={d.x}
              className="absolute bottom-6 h-24 w-7 origin-bottom-left rounded-[3px] border border-cyan-200/30 bg-gradient-to-b from-slate-200/90 to-slate-400/40 shadow-glow"
              style={{ left: d.x }}
              initial={{ rotate: 0 }}
              animate={{ rotate: i === DOMINOES.length - 1 ? 68 : 66 }}
              transition={{ delay: d.delay + 0.5, duration: 0.5, ease: 'easeIn' }}
            />
          ))}
          <motion.div
            className="absolute bottom-16 left-0 text-2xl"
            initial={{ x: -10, y: 0, opacity: 0 }}
            animate={{ x: 300, y: -34, opacity: [0, 1, 1, 0.9] }}
            transition={{ delay: 1.7, duration: 2.4, ease: 'easeOut' }}
          >
            ✈
          </motion.div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="absolute bottom-3 left-0 text-[10px] uppercase tracking-[0.3em] text-slate-600">
            Delay propagates along the tail chain
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-sm space-y-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.12 }}
              className="glass-soft flex gap-3 p-3"
            >
              <span className="tnum text-xs font-semibold text-cyan-300/70">{s.n}</span>
              <div>
                <div className="text-xs font-semibold text-slate-100">{s.title}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.text}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
