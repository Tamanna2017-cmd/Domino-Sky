import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const Panel = ({
  title,
  right,
  children,
  className = '',
  bodyClass = 'p-3',
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) => (
  <section className={`glass flex min-h-0 flex-col ${className}`}>
    {title && (
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <h3 className="label">{title}</h3>
        {right}
      </header>
    )}
    <div className={`min-h-0 ${bodyClass}`}>{children}</div>
  </section>
);

export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className={`glass relative z-10 flex max-h-[88vh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-lg'}`}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
              </div>
              <button className="btn !px-2 !py-1" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </header>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TONES: Record<string, string> = {
  cyan: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-200',
  amber: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  red: 'border-rose-300/30 bg-rose-400/10 text-rose-200',
  green: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
  violet: 'border-violet-300/30 bg-violet-400/10 text-violet-200',
  slate: 'border-white/10 bg-white/5 text-slate-300',
};

export const Badge = ({ tone = 'slate', children }: { tone?: string; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONES[tone] ?? TONES.slate}`}>
    {children}
  </span>
);

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) => (
  <div className={`flex rounded-lg border border-white/10 bg-black/30 p-0.5 ${className}`}>
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={`flex-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
          value === o.value ? 'bg-cyan-400/20 text-cyan-100 shadow-glow' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export function useCountUp(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value);
  const latest = useRef(value);
  latest.current = display;
  useEffect(() => {
    const from = latest.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export const Stat = ({
  label,
  value,
  sub,
  tone = 'text-white',
  compact = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
  compact?: boolean;
}) => (
  <div className={`glass-soft ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
    <div className="label truncate">{label}</div>
    <div className={`tnum mt-0.5 font-semibold ${compact ? 'text-base' : 'text-xl'} ${tone}`}>
      {value}
    </div>
    {sub && <div className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</div>}
  </div>
);

export const Meter = ({
  value,
  max,
  tone = 'from-cyan-400 to-teal-300',
  height = 'h-1.5',
}: {
  value: number;
  max: number;
  tone?: string;
  height?: string;
}) => (
  <div className={`w-full overflow-hidden rounded-full bg-white/5 ${height}`}>
    <motion.div
      className={`h-full rounded-full bg-gradient-to-r ${tone}`}
      animate={{ width: `${Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100))}%` }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
    />
  </div>
);

export const Sparkline = ({
  values,
  color = '#22d3ee',
  width = 120,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) => {
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
};

export const Select = ({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-400/50 ${className}`}
  >
    {children}
  </select>
);
