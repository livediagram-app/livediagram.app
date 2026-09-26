import type { CSSProperties } from 'react';
import { PlusWideIcon } from '@livediagram/ui';
import { eventStormingNote, type EventStormingNoteKind } from '@livediagram/diagram';

// A note that is about to be added (spec/139): a dashed outline in the note's
// own colour, its kind named inside. Drawn by the next-note tabs' hover
// preview and by an armed palette tile's ghost, so both say "this note, here"
// the same way. Only a picture: pointer events pass through.
//
// `box` is in the caller's coordinate space; `px` is one screen pixel in that
// space (1 / zoom inside the scaled canvas layer, 1 in screen space), so the
// outline stays a crisp 2px at any zoom.
export function NoteGhost({
  kind,
  box,
  px,
  position,
  testId,
}: {
  kind: EventStormingNoteKind | null;
  box: { x: number; y: number; width: number; height: number };
  px: number;
  position: 'absolute' | 'fixed';
  testId: string;
}) {
  // A plain sticky has no kind; it ghosts in the plain note's yellow.
  const fill = kind ? eventStormingNote(kind).fill : '#fde68a';
  const style: CSSProperties = {
    position,
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    border: `${2 * px}px dashed ${fill}`,
    borderRadius: box.height * 0.03,
    background: `${fill}2e`,
    color: fill,
    fontSize: box.height * 0.075,
    gap: box.height * 0.02,
  };
  return (
    <div
      aria-hidden
      data-testid={testId}
      className="pointer-events-none z-[var(--z-chrome)] flex flex-col items-center justify-center font-semibold"
      style={style}
    >
      <PlusWideIcon size={box.height * 0.12} />
      {kind ? eventStormingNote(kind).label : 'Sticky note'}
    </div>
  );
}
