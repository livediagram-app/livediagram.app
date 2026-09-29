'use client';

import { useEffect, useState } from 'react';
import { Button, RefreshIcon } from '@livediagram/ui';
import { DiagramBuildAnimation } from '@/components/canvas/DiagramBuildAnimation';

// The opening screen (docs/specs/007-editor/new-diagram-route.md): the one
// full-height screen between a click and the editor. /new renders it at the
// "creating" stage while the diagram is persisted, the editor renders it at
// the "opening" stage while the diagram loads, and because /new hands off to
// the editor in place the two read as one continuous screen: only the label
// changes, and DiagramBuildAnimation keeps its phase across the remount.
//
// Dark-aware on purpose: it is a whole SCREEN, not a panel, so it honours
// the appearance like every other route (docs/specs/007-editor/live-app.md).
// If the wait passes 10 seconds, it offers a Refresh as a way out.

export type DiagramLoadingStage = 'creating' | 'opening';

const COPY: Record<DiagramLoadingStage, { title: string; detail: string }> = {
  creating: { title: 'Creating your diagram', detail: 'Setting up a fresh canvas' },
  opening: { title: 'Opening your diagram', detail: 'Getting everything in place' },
};

const SLOW_AFTER_MS = 10_000;

// Glow drift, the progress sweep and the label's entrance. Motion only when
// the user allows it; reduced motion keeps the screen still.
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .ldl-glow-a { animation: ldl-drift-a 14s ease-in-out infinite alternate; }
  .ldl-glow-b { animation: ldl-drift-b 18s ease-in-out infinite alternate; }
  .ldl-sweep { animation: ldl-sweep 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
  .ldl-enter { animation: ldl-enter 250ms cubic-bezier(0.22, 1, 0.36, 1) both; }
}
.ldl-sweep { transform: translateX(-100%); }
@keyframes ldl-drift-a {
  from { transform: translate(-12%, -8%) scale(1); }
  to { transform: translate(10%, 6%) scale(1.15); }
}
@keyframes ldl-drift-b {
  from { transform: translate(10%, 10%) scale(1.1); }
  to { transform: translate(-8%, -6%) scale(0.95); }
}
@keyframes ldl-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}
@keyframes ldl-enter {
  from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
  to { opacity: 1; transform: none; filter: none; }
}`;

export function DiagramLoading({ stage = 'opening' }: { stage?: DiagramLoadingStage }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);
  const copy = COPY[stage];

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-slate-50 px-6 dark:bg-slate-950">
      {/* Backdrop: two soft brand-tinted glows behind the centre and the
          editor's dot grid, fading out towards the edges. Decorative. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="ldl-glow-a absolute top-1/2 left-1/2 -mt-72 -ml-80 size-[36rem] rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/15" />
        <div className="ldl-glow-b absolute top-1/2 left-1/2 -mt-40 -ml-24 size-[30rem] rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-500/12" />
        <div
          className="absolute inset-0 text-slate-300 dark:text-slate-800"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, black 20%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 55% at 50% 50%, black 20%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <DiagramBuildAnimation className="max-w-[360px]" />

        <div role="status" aria-live="polite" className="mt-8 flex flex-col items-center">
          {/* Keyed on the stage so the label re-enters when "Creating"
              gives way to "Opening". */}
          <div key={stage} className="ldl-enter flex flex-col items-center gap-1 text-center">
            <p className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              {copy.title}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{copy.detail}</p>
          </div>
          <div
            aria-hidden="true"
            className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
          >
            <div className="ldl-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400" />
          </div>
        </div>

        {slow ? (
          <div className="ldl-enter mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This is taking longer than usual.
            </p>
            <Button variant="secondary" size="xs" onClick={() => window.location.reload()}>
              <RefreshIcon size={13} />
              Refresh
            </Button>
          </div>
        ) : null}
      </div>
      <style>{CSS}</style>
    </div>
  );
}
