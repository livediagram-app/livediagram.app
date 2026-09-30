'use client';

import { DiagramBuildAnimation } from './DiagramBuildAnimation';

// The loader that sits on a blank canvas while a new document is made: the marketing hero's
// launch window grows into a canvas, and /new?blank=1&welcome=1 holds that same canvas until the
// editor is ready (docs/specs/007-editor/new-document-route.md). /new shows this from its first
// frame (prerendered, then BlankCanvasScreen, then the editor's own quiet opening screen), centred
// in the viewport, and the drawing loop keeps its phase across those remounts
// (DiagramBuildAnimation), so it reads as ONE loader running until the editor appears. The sweep
// is the opening screen's progress bar (DocumentLoading). No surface of its own: the canvas behind
// it is the host's.

// The progress sweep, as the opening screen draws it. Motion only when the user allows it.
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .cvl-sweep { animation: cvl-sweep 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
}
.cvl-sweep { transform: translateX(-100%); }
@keyframes cvl-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}`;

export function CanvasLoader({ label = 'Creating your document' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col items-center">
      <DiagramBuildAnimation className="max-w-[280px]" />
      <p className="mt-6 text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div
        aria-hidden="true"
        className="mt-4 h-1 w-36 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
      >
        <div className="cvl-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400" />
      </div>
      <style>{CSS}</style>
    </div>
  );
}
