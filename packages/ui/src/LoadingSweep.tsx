'use client';

import { useRef } from 'react';
import { useLoopPhase } from './build-animation-kit';

// The loaders' progress sweep (docs/specs/004-interface-design/motion.md): a short brand gradient crossing a slim
// track, again and again. Still under reduced motion. A remount (one loading screen handing over to the next) carries
// on mid-sweep rather than starting over (useLoopPhase).
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .lds-sweep { animation: lds-sweep 1.6s cubic-bezier(0.65, 0, 0.35, 1) var(--lds-delay, 0ms) infinite; }
}
@media (prefers-reduced-motion: reduce) {
  .lds-sweep { animation: none; }
}
.lds-sweep { transform: translateX(-100%); }
@keyframes lds-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}`;

const SWEEP_MS = 1600;

export function LoadingSweep({ className = 'w-40' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLoopPhase(ref, 'sweep', SWEEP_MS, '--lds-delay');
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800 ${className}`}
    >
      <div className="lds-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400" />
      <style>{CSS}</style>
    </div>
  );
}
