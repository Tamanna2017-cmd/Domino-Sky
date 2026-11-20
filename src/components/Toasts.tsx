import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useSimStore } from '../store/useSimStore';

const TONE: Record<string, string> = {
  info: 'border-cyan-400/30 bg-ink-800/90 text-cyan-100',
  good: 'border-emerald-400/30 bg-emerald-950/80 text-emerald-100',
  warn: 'border-amber-400/30 bg-amber-950/80 text-amber-100',
  danger: 'border-rose-400/30 bg-rose-950/80 text-rose-100',
};

const ICON: Record<string, string> = { info: '▸', good: '✓', warn: '▲', danger: '⚠' };

export const Toasts = () => {
  const toasts = useSimStore((s) => s.toasts);
  const dismiss = useSimStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), 4200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 text-xs shadow-panel backdrop-blur-xl ${TONE[t.tone]}`}
          >
            <span className="mt-0.5 text-sm leading-none">{ICON[t.tone]}</span>
            <span className="flex-1 leading-snug">{t.text}</span>
            <button className="text-white/40 hover:text-white" onClick={() => dismiss(t.id)}>
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
