'use client';

import { activeCommentCount, type ShapeElement } from '@livediagram/diagram';

import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// The face of a Comment Pin (spec/136): a marker you drop on the board that
// opens a comment thread.
//
// It carries NO comment machinery of its own. Every element can already hold a
// `commentThread`, and the popover, the composer, resolve / unresolve, the
// author badges, the realtime plumbing and the persistence all already work
// against that field. A pin is simply an element whose only job is to hold
// one, so this file is a glyph and a click handler — the thread it opens is
// the same thread an ordinary shape's comment badge opens.
//
// Which is the whole point of the element. Comments already attach to things;
// what was missing was somewhere to attach a remark that is about a PLACE
// rather than about a shape — an empty patch of canvas, a gap between two
// clusters, the spot where something should go.
//
// Interaction rules match the other pressable faces (spec/103, /104, /135): a
// real <button> so the click travels rather than only selecting,
// `pointer-events: auto` so it works inside the pointer-inert Avatar /
// Spotlight / Isometric layers, and pointer-down left alone so dragging still
// moves the pin.

export function CommentPinFace({
  element,
  fill,
  onOpenComments,
}: {
  element: ShapeElement;
  // The pin's own colour, so recolouring it from the menu recolours the
  // marker rather than stranding a hard-coded blue.
  fill: string;
  // Absent on a surface with no comment session (the read-only embed, the
  // export renderer), which renders the pin inert but still readable.
  onOpenComments?: () => void;
}) {
  // Called unconditionally, above the read-only early return below: a hook
  // after a conditional return is a rules-of-hooks violation, and this
  // component has exactly one branch that would trip it.
  const press = usePressWithoutDrag(onOpenComments);
  const thread = element.commentThread;
  const count = activeCommentCount(thread);
  // A resolved thread keeps its comments (they come back on unresolve), so the
  // pin stays on the board and goes quiet rather than disappearing: a pin that
  // vanished on resolve would take the reason for the conversation with it.
  const resolved = thread?.resolved === true;
  const empty = !thread || thread.comments.length === 0;

  const face = (
    <span
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
        resolved ? 'opacity-45' : ''
      }`}
      style={{ containerType: 'size' }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* A pin: a rounded speech bubble with the tail at the bottom-left, so
            the point marks the SPOT rather than the middle of the bubble. */}
        <path
          d="M20 2.5c8.9 0 16 5.9 16 13.2 0 7.3-7.1 13.2-16 13.2-1.6 0-3.2-.2-4.6-.5l-8.7 8.1a1 1 0 0 1-1.7-.9l1.6-9.4C2.6 23.7 4 19.9 4 15.7 4 8.4 11.1 2.5 20 2.5z"
          fill={fill}
          stroke="rgba(15,23,42,0.18)"
          strokeWidth="1.2"
        />
      </svg>
      <span
        // Sized against the pin so a resized marker scales its number.
        className="relative font-semibold leading-none text-white"
        style={{ fontSize: 'min(38cqw, 38cqh)', marginBottom: '18%' }}
      >
        {/* An empty pin shows a bubble-with-dots rather than a "0": zero
            comments is not a count, it is an invitation. */}
        {empty ? '…' : count > 0 ? count : '✓'}
      </span>
    </span>
  );

  if (!onOpenComments) {
    return (
      <div className="pointer-events-none relative h-full w-full" role="img" aria-label="Comment">
        {face}
      </div>
    );
  }

  return (
    <Tooltip
      block
      className="h-full w-full"
      title={
        empty
          ? 'Empty comment pin'
          : resolved
            ? 'Resolved comment'
            : `${count} comment${count === 1 ? '' : 's'}`
      }
      description="Click to open the thread. Drag it anywhere on the board."
    >
      <button
        type="button"
        {...press}
        aria-label={
          empty
            ? 'Open empty comment thread'
            : `Open comment thread, ${count} comment${count === 1 ? '' : 's'}`
        }
        className="pointer-events-auto relative h-full w-full cursor-pointer"
      >
        {face}
      </button>
    </Tooltip>
  );
}
