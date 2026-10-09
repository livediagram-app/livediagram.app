'use client';

// The loaders' progress sweep (docs/specs/004-interface-design/motion.md): a short brand gradient crossing a slim
// track, again and again. Still under reduced motion.
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .lds-sweep { animation: lds-sweep 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
}
@media (prefers-reduced-motion: reduce) {
  .lds-sweep { animation: none; }
}
.lds-sweep { transform: translateX(-100%); }
@keyframes lds-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}`;

export function LoadingSweep({ className = 'w-40' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800 ${className}`}
    >
      <div className="lds-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400" />
      <style>{CSS}</style>
    </div>
  );
}
