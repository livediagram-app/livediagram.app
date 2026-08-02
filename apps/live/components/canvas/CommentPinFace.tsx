'use client';

import { activeCommentCount, type ShapeElement } from '@livediagram/diagram';

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
      className={`pointer-events-none absolute inset-0 ${resolved ? 'opacity-45' : ''}`}
      style={{ containerType: 'size' }}
    >
      {/* An anchor DOT with a thin leader LINE coming out of it, the way Miro
          marks a comment.

          The dot is the whole point: it sits on the exact spot being remarked
          on, and stays small enough not to cover it. Everything a bubble would
          have carried — the count, the author, the text — belongs in the
          thread that opens on click, not on the board. A marker big enough to
          hold a number hides the thing it is pointing at, which is the one job
          it must not do.

          The line reads as "this remark belongs over there" and gives the
          40px element a grab area wider than the 8px dot. */}
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M11 20h24" stroke={fill} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="6.5" cy="20" r="4.5" fill={fill} />
      </svg>
      <span
        className="absolute font-semibold leading-none"
        style={{
          // Riding the END of the leader line rather than sitting inside the
          // dot: the dot is 9 units across and a numeral in it would be
          // illegible at any real zoom.
          left: '88%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 'min(22cqw, 22cqh)',
          color: fill,
        }}
      >
        {/* Nothing on an empty pin: a bare dot is the invitation. A resolved
            thread shows a tick instead of a stale count. */}
        {empty ? '' : resolved ? '✓' : count > 1 ? count : ''}
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

  // No tooltip. The marker's whole job is to be unobtrusive, and a hover card
  // over a 40px pin covers more board than the pin does. What it would have
  // said (how many comments, whether it is resolved) the pin already shows,
  // and the rest is one click away. The accessible name still carries it for
  // anyone not reading the glyph.
  return (
    <button
      type="button"
      {...press}
      aria-label={
        empty
          ? 'Open empty comment thread'
          : resolved
            ? `Open resolved comment thread, ${count} comment${count === 1 ? '' : 's'}`
            : `Open comment thread, ${count} comment${count === 1 ? '' : 's'}`
      }
      className="pointer-events-auto relative h-full w-full cursor-pointer"
    >
      {face}
    </button>
  );
}
