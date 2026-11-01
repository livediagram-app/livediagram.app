import type { ReactNode } from 'react';
import type { EditorMode } from '@livediagram/document';

// The mode menu's preview picture (docs/specs/007-editor/editor-modes.md "The mode switch"): each
// mode's work in a few strokes, on a 120 x 56 grid, in the current colour (the mode's tint).
// Decorative: the preview is hidden from assistive technology.
export function ModePreviewArt({ mode }: { mode: EditorMode }) {
  return (
    <svg
      viewBox="0 0 120 56"
      width={120}
      height={56}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-mode-art={mode}
    >
      {ART[mode]}
    </svg>
  );
}

const ART: Record<EditorMode, ReactNode> = {
  // Three boxes joined by arrows, one filled.
  diagram: (
    <>
      <rect x="8" y="8" width="30" height="16" rx="4" />
      <rect x="82" y="8" width="30" height="16" rx="4" />
      <rect x="45" y="34" width="30" height="16" rx="4" fill="currentColor" fillOpacity=".15" />
      <path d="M38 16h44M23 24v18h22M97 24v18H75" />
      <path d="m78 13 4 3-4 3" />
    </>
  ),
  // A freehand line, a sketched circle and a cross.
  draw: (
    <>
      <path
        d="M10 40c10-22 18-26 24-14s10 14 18-2 16-18 22-4 12 16 20 6 10-12 16-10"
        strokeWidth={2.4}
      />
      <circle cx="30" cy="16" r="7" strokeDasharray="3 3" strokeWidth={1.6} />
      <path d="M92 10l8 8M100 10l-8 8" strokeWidth={1.6} />
    </>
  ),
  // Two stickies with votes under them, and a timer.
  workshop: (
    <>
      <rect x="10" y="10" width="22" height="22" rx="2" fill="currentColor" fillOpacity=".18" />
      <rect x="36" y="14" width="22" height="22" rx="2" fill="currentColor" fillOpacity=".18" />
      <circle cx="20" cy="42" r="3" fill="currentColor" />
      <circle cx="29" cy="42" r="3" fill="currentColor" />
      <circle cx="47" cy="45" r="3" fill="currentColor" />
      <circle cx="90" cy="28" r="16" />
      <path d="M90 18v10l7 5M86 8h8" />
    </>
  ),
};
