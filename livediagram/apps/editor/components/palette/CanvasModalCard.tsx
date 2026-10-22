'use client';

import type { ReactNode } from 'react';

// The card the New Document wizard and the visitor name prompt sit in (docs/specs/007-editor/new-document-route.md
// "Responsive layout"): centred and floating from `sm` up (rounded, bordered, shadowed, `width` wide), edge to edge on a
// phone, with no backdrop, on the `canvas-modal` rung so the header's menus still open in front of it. The body scrolls
// inside it while its header and footer stay put.
export function CanvasModalCard({
  label,
  width,
  children,
}: {
  label: string;
  // The `sm:` width class: `sm:w-[44rem]` for the wizard, `sm:w-[26rem]` for the name prompt.
  width: string;
  children: ReactNode;
}) {
  return (
    <div
      // Presses inside never reach the canvas behind it.
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute inset-0 z-[var(--z-canvas-modal)] flex items-center justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`pointer-events-auto flex h-full w-full animate-fly-up-in flex-col bg-white dark:bg-slate-900 sm:h-auto sm:max-h-[90vh] ${width} sm:max-w-[92%] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl sm:shadow-slate-900/10 dark:sm:border-slate-800 dark:sm:shadow-black/40`}
      >
        {children}
      </div>
    </div>
  );
}
