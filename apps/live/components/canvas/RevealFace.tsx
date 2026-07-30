// The face of a Reveal zone (spec/106): a frosted cover over whatever it
// overlaps, with the two ways to take it off.
//
// The cover is opaque rather than blurred ON PURPOSE. A blur would imply the
// content underneath is protected, and it isn't: everything under a cover is
// still in the document, the export, and the API response. The tooltip says
// so, and the spec is the honest record of it.
//
// Uncovering locally takes a DOUBLE press: a cover exists to stay closed, and
// one stray click on a board people are dragging things around would undo the
// whole point of it. The Hide pill stays a single click — putting the cover
// back by accident costs nothing.
//
// Local reveal is a viewer's own business and never touches the
// document; the shared reveal lives in `revealed` on the element and is an
// ordinary edit. When it is uncovered locally, the panel gets out of the way
// completely — pointer-events included, so the content underneath is editable
// — leaving one small Hide pill to put it back.

import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { useCoarsePointer } from '@/hooks/ui/useCoarsePointer';

function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.6 8s2.4-4 6.4-4 6.4 4 6.4 4-2.4 4-6.4 4-6.4-4-6.4-4z" />
      <circle cx="8" cy="8" r="1.8" />
      {off ? <path d="M2.4 2.4l11.2 11.2" /> : null}
    </svg>
  );
}

export function RevealFace({
  label,
  textColor,
  strokeColor,
  // Uncovered for EVERYONE (the element's own state), vs just for me.
  revealedForAll,
  revealedForMe,
  onToggleForMe,
}: {
  label: string;
  textColor: string;
  strokeColor: string;
  revealedForAll: boolean;
  revealedForMe: boolean;
  // Absent on a surface with no interaction at all (an export render).
  onToggleForMe?: () => void;
}) {
  // The cover needs two presses; the pill needs one (see the header).
  const coverPress = usePressWithoutDrag(onToggleForMe, { requireDouble: true });
  const pillPress = usePressWithoutDrag(onToggleForMe);
  const coarse = useCoarsePointer();
  const gesture = coarse ? 'Double-tap' : 'Double-click';
  const uncovered = revealedForAll || revealedForMe;

  // Uncovered for the room: nothing to draw. The element is still selectable
  // by its outline in Select mode (the selection chrome renders regardless),
  // so it can be moved, re-hidden from the menu, or deleted.
  if (revealedForAll) return null;

  if (uncovered) {
    return (
      // Only the pill takes pointers, so a locally-revealed zone doesn't sit
      // between the user and the content they came to read.
      <div className="pointer-events-none absolute inset-0">
        <Tooltip
          className="pointer-events-auto absolute right-1 top-1"
          title="Hide it again"
          description="Only affects your screen."
        >
          <button
            type="button"
            {...pillPress}
            className="flex cursor-pointer items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-white shadow-sm transition hover:bg-slate-900"
          >
            <EyeIcon off />
            Hide
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <Tooltip
      block
      className="h-full w-full"
      title={label.trim() || 'Hidden'}
      description={`${gesture} to uncover it on your screen only. Anyone can move the cover, so it hides content from a reader, not from a determined one.`}
    >
      <button
        type="button"
        aria-label={`${label.trim() || 'Hidden'} — ${gesture.toLowerCase()} to reveal`}
        {...coverPress}
        // The cover itself: a solid frosted panel, dashed to read as
        // temporary rather than as a box someone drew.
        className="pointer-events-auto flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[inherit] border-2 border-dashed bg-slate-100/95 transition hover:bg-slate-50 dark:bg-slate-800/95 dark:hover:bg-slate-800"
        style={{ borderColor: strokeColor }}
      >
        <span style={{ color: textColor }} className="opacity-70">
          <EyeIcon />
        </span>
        <span className="px-3 text-center text-[13px] font-semibold" style={{ color: textColor }}>
          {label.trim() || 'Hidden'}
        </span>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.08em] opacity-60"
          style={{ color: textColor }}
        >
          {gesture} to reveal
        </span>
      </button>
    </Tooltip>
  );
}
