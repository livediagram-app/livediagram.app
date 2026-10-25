'use client';

import { useLayoutEffect, useState } from 'react';
import { Portal } from '@liveplanner/ui';
import type { TextRun } from '@liveplanner/project';
import { NoteRichText } from '@/components/notes/NoteRichText';
import { VIEWPORT_EDGE_MARGIN as EDGE_MARGIN } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

const GAP = 10;
const MAX_W = 280;

// Read-only note preview that floats ABOVE every canvas element when an
// annotation is hovered (docs/specs/009-elements/annotations.md). Portaled to the body with a high
// z-index so it's legible even when other elements are painted on top of
// the marker. Anchors to the marker's live DOM rect (which already
// includes the canvas pan + zoom) the same way NotePopover does, so it
// stays attached as the canvas moves. No interactivity — hovering is a
// read gesture; clicking the marker opens the editable popover instead. The
// note is drawn by the shared NoteRichText renderer (docs/specs/009-elements/rich-text-notes.md), so headings /
// lists / links read the same here as they do in the popover.
export function AnnotationHoverNote({
  elementId,
  note,
  noteRich,
}: {
  elementId: string;
  note: string;
  noteRich?: TextRun[];
}) {
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const node = document.querySelector(elementSelector(elementId));
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const left = Math.max(
        EDGE_MARGIN + MAX_W / 2,
        Math.min(rect.left + rect.width / 2, window.innerWidth - EDGE_MARGIN - MAX_W / 2),
      );
      // Prefer above the marker; flip below when there's no room up top.
      const below = rect.top - GAP < 120;
      const top = below ? rect.bottom + GAP : rect.top - GAP;
      setPos({ left, top, below });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [elementId]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        className="pointer-events-none fixed z-[var(--z-toast)] max-h-60 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 leading-snug text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/50"
        style={{
          left: pos.left,
          top: pos.top,
          maxWidth: MAX_W,
          transform: `translate(-50%, ${pos.below ? '0' : '-100%'})`,
        }}
      >
        <NoteRichText note={note} noteRich={noteRich} />
      </div>
    </Portal>
  );
}
