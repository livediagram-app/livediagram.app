'use client';

import type { PointerEvent } from 'react';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import type { Corner } from '@/lib/photo-boxes';

// What a SELECTED box offers (spec/139 Phase 9): its tick, a handle on each
// corner to resize it, the eight paper colours to change its kind, and a way to delete
// it. Like the tick and the words, all of it keeps its size on SCREEN at any
// zoom — so each piece is placed on the box and then scaled back down by the
// zoom about the point it hangs from.

const CORNERS: { corner: Corner; left: string; top: string; cursor: string }[] = [
  { corner: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { corner: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { corner: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { corner: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
];

// Nothing here is a drag that draws a box or moves this one.
const stop = (e: PointerEvent) => e.stopPropagation();

export function BoxEditControls({
  ticked,
  includeLabel,
  onToggle,
  kind,
  zoom,
  onResizeStart,
  onKind,
  onDelete,
}: {
  // The box's tick, moved here while the box is selected (its corner belongs
  // to a resize handle then).
  ticked: boolean;
  includeLabel: string;
  onToggle: () => void;
  kind: string;
  zoom: number;
  onResizeStart: (e: PointerEvent, corner: Corner) => void;
  onKind: (kind: string) => void;
  onDelete: () => void;
}) {
  const unzoom = `scale(${1 / zoom})`;
  return (
    <>
      {CORNERS.map(({ corner, left, top, cursor }) => (
        <span
          key={corner}
          data-testid={`box-handle-${corner}`}
          aria-hidden
          onPointerDown={(e) => onResizeStart(e, corner)}
          className="pointer-events-auto absolute z-30 h-3 w-3 rounded-sm border-2 border-white bg-brand-500 shadow"
          style={{ left, top, cursor, transform: `translate(-50%, -50%) ${unzoom}` }}
        />
      ))}
      <div
        role="toolbar"
        aria-label="Correct this box"
        onPointerDown={stop}
        className="pointer-events-auto absolute bottom-full left-0 z-30 flex items-center gap-1 whitespace-nowrap pb-2"
        style={{ transform: unzoom, transformOrigin: 'bottom left' }}
      >
        <div className="flex items-center gap-1 rounded-full bg-slate-900/90 p-1 shadow-lg">
          <button
            type="button"
            role="checkbox"
            aria-checked={ticked}
            aria-label={includeLabel}
            onClick={onToggle}
            className="mr-1 flex h-5 w-5 items-center justify-center rounded-sm border border-white/70 text-[10px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
          >
            {ticked ? '✓' : ''}
          </button>
          {EVENT_STORMING_NOTES.map((note) => (
            <button
              key={note.kind}
              type="button"
              aria-label={`Make this a ${note.label.toLowerCase()}`}
              aria-pressed={note.kind === kind}
              title={note.label}
              onClick={() => onKind(note.kind)}
              className={`h-5 w-5 rounded-full border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                note.kind === kind ? 'border-white' : 'border-transparent'
              }`}
              style={{ background: note.fill }}
            />
          ))}
          <button
            type="button"
            aria-label="Delete this box"
            title="Delete (Del)"
            onClick={onDelete}
            className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-white hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
