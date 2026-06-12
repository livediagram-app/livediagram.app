import { useLayoutEffect, useRef, useState } from 'react';
import { isMobileViewportSync } from '@/lib/responsive';
import { Tooltip } from './Tooltip';

type Bounds = { x: number; y: number; width: number; height: number };

type SelectionPopoverProps = {
  bounds: Bounds;
  canvasOffset: { x: number; y: number };
  zoom: number;
  // Lock state + toggler. Optional so the read-only / view-role
  // mode (no edit handlers) can mount the popover without faking a
  // lock toggle; when omitted the lock button is suppressed.
  locked?: boolean;
  onToggleLock?: () => void;
  onDelete?: () => void;
  onCopyFormat?: () => void;
  // Duplicate the selected element. Sits next to Copy formatting as a
  // one-click toolbar action (it used to live only in the right-click
  // context menu). Omitted in read-only / view-role mode.
  onDuplicate?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  // Open the comment thread. The toolbar shows the Comment button
  // whenever this is passed, regardless of any other props, which
  // is how view-role visitors get the comments-only toolbar (no
  // edit affordances next to it).
  onOpenComments?: () => void;
  // Open the same context menu that a right-click on the element
  // would open, anchored under the ellipsis button. Surfaces the
  // full action list on touch devices that can't right-click.
  onOpenContextMenu?: (screenX: number, screenY: number) => void;
  // Tighter gap between the popover and the element edge. Set
  // by the view-role caller because the plus duplicate button
  // (which sits in this gap for editor sessions) doesn't render
  // when read-only, so the toolbar can sit closer to the element
  // without overlapping anything.
  compact?: boolean;
  // Force the toolbar to the side OPPOSITE the named edge, regardless of
  // the usual above/below fit logic. Set to the open quick-connect ring's
  // vertical side ('above' / 'below') so the toolbar doesn't cover its
  // pop-out menu (spec/09); null leaves placement to the fit logic.
  avoidVertical?: 'above' | 'below' | null;
};

// Default gap: leave room for the plus duplicate button between
// the popover and the element edge. Bumped to 48 px so the plus
// has clear breathing room (at 36 px the popover crowded it and
// felt visually cramped). `compact` callers (view-role) drop to
// 16 px since there's no plus button to clear.
const GAP_DEFAULT = 48;
const GAP_COMPACT = 16;
const EDGE_MARGIN = 8;

export function SelectionPopover({
  bounds,
  canvasOffset,
  zoom,
  locked = false,
  onToggleLock,
  onDelete,
  onCopyFormat,
  onDuplicate,
  onGroup,
  onUngroup,
  onOpenComments,
  onOpenContextMenu,
  compact = false,
  avoidVertical = null,
}: SelectionPopoverProps) {
  const ellipsisRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Above/below flip guard: the geometry signature it last flipped
  // for, and whether it has already flipped for that geometry.
  const flipSigRef = useRef('');
  const flippedRef = useRef(false);
  // Prefer above by default on desktop, below on mobile. Mobile
  // defaults to below because the Palette pins the top-right of
  // the viewport: an above-the-element popover near the top of
  // the canvas would land underneath it. The layoutEffect below
  // still flips to "below" on desktop if there's no room above
  // (and equivalently flips to "above" on mobile if there's no
  // room below). The initial value just picks the better-odds
  // starting placement per device class.
  const [placeAbove, setPlaceAbove] = useState(() => !isMobileViewportSync());

  // avoidVertical overrides the fit-based placement (a ring is open on
  // that side): sit on the opposite side. 'above' → below, 'below' → above.
  const effectiveAbove =
    avoidVertical === 'above' ? false : avoidVertical === 'below' ? true : placeAbove;
  const visualGap = (compact ? GAP_COMPACT : GAP_DEFAULT) / zoom;
  const baseTop = effectiveAbove ? bounds.y - visualGap : bounds.y + bounds.height + visualGap;
  const baseLeft = bounds.x + bounds.width / 2;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // The geometry that legitimately changes where the popover should
    // sit. When it changes we earn a fresh above/below flip decision;
    // for the SAME geometry we allow at most one flip so a popover
    // that fits neither side can't ping-pong above<->below forever
    // (that infinite synchronous re-render is what tripped React's
    // "Maximum update depth exceeded" while panning a selection).
    const sig = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${canvasOffset.x},${canvasOffset.y},${zoom}`;
    if (flipSigRef.current !== sig) {
      flipSigRef.current = sig;
      flippedRef.current = false;
    }
    const rect = node.getBoundingClientRect();
    // Flip above<->below at most once per geometry (the guard), so a
    // popover that fits neither side can't ping-pong forever — that
    // infinite synchronous re-render is what tripped "Maximum update
    // depth". `adjust` is intentionally NOT a dependency: this runs
    // once per geometry change and applies a one-shot nudge, so it
    // never re-enters on its own setAdjust.
    // Skip the fit-based flip while a side is forced: the placement is
    // fixed, and measuring against the forced position would flip-flop.
    if (!avoidVertical && !flippedRef.current) {
      if (placeAbove && rect.top < EDGE_MARGIN) {
        flippedRef.current = true;
        setPlaceAbove(false);
        return;
      }
      if (!placeAbove && rect.bottom > window.innerHeight - EDGE_MARGIN) {
        flippedRef.current = true;
        setPlaceAbove(true);
        return;
      }
    }
    let dx = 0;
    let dy = 0;
    if (rect.left < EDGE_MARGIN) dx = EDGE_MARGIN - rect.left;
    else if (rect.right > window.innerWidth - EDGE_MARGIN)
      dx = window.innerWidth - EDGE_MARGIN - rect.right;
    if (rect.top < EDGE_MARGIN) dy = EDGE_MARGIN - rect.top;
    else if (rect.bottom > window.innerHeight - EDGE_MARGIN)
      dy = window.innerHeight - EDGE_MARGIN - rect.bottom;
    if (dx !== adjust.x || dy !== adjust.y) setAdjust({ x: dx, y: dy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    canvasOffset.x,
    canvasOffset.y,
    placeAbove,
    avoidVertical,
  ]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto absolute z-20 flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={{
        left: baseLeft + adjust.x,
        top: baseTop + adjust.y,
        // Counter-scale so the popover renders at its natural on-screen
        // size regardless of canvas zoom. Origin pinned to the centre edge
        // closest to the selected element so the popover stays attached.
        transform: `translate(-50%, ${placeAbove ? '-100%' : '0'}) scale(${1 / zoom})`,
        transformOrigin: placeAbove ? 'center bottom' : 'center top',
      }}
    >
      {onOpenContextMenu ? (
        <>
          <Tooltip title="More" description="Open the element menu.">
            <button
              ref={ellipsisRef}
              type="button"
              onClick={() => {
                const rect = ellipsisRef.current?.getBoundingClientRect();
                if (!rect) return;
                onOpenContextMenu(rect.left, rect.bottom);
              }}
              aria-label="More actions"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <EllipsisIcon />
            </button>
          </Tooltip>
          <Divider />
        </>
      ) : null}

      {onCopyFormat ? (
        <>
          <PopoverButton
            label="Copy formatting"
            description="Apply this size to the next click."
            onClick={onCopyFormat}
          >
            <PaintbrushIcon />
          </PopoverButton>
          <Divider />
        </>
      ) : null}

      {onDuplicate ? (
        <>
          <PopoverButton
            label="Duplicate"
            description="Create a copy of this element."
            onClick={onDuplicate}
          >
            <DuplicateIcon />
          </PopoverButton>
          <Divider />
        </>
      ) : null}

      {/* Comment stays on the toolbar (it's the only edit-adjacent
          action a view-role visitor gets, so it has to be reachable
          without right-clicking on a comment badge). For an editor
          session it duplicates the context menu entry, which is
          fine: comments are high-traffic and a one-click affordance
          beats a two-click context menu open + click. */}
      {onOpenComments ? (
        <PopoverButton
          label="Comments"
          description="Open the comment thread for this element."
          onClick={onOpenComments}
        >
          <CommentIcon />
        </PopoverButton>
      ) : null}

      {onUngroup ? (
        <PopoverButton
          label="Ungroup"
          description="Break group; members move alone."
          onClick={onUngroup}
        >
          <UngroupIcon />
        </PopoverButton>
      ) : onGroup ? (
        <PopoverButton
          label="Group with another"
          description="Click elements to group with this."
          onClick={onGroup}
        >
          <GroupIcon />
        </PopoverButton>
      ) : null}
      {onToggleLock ? (
        <Tooltip
          title={locked ? 'Unlock' : 'Lock'}
          description={
            locked
              ? 'Allow this element to be moved, resized, and deleted again.'
              : 'Protect from moves, resizes, and deletion. You can still unlock it.'
          }
        >
          <button
            type="button"
            onClick={onToggleLock}
            aria-label={locked ? 'Unlock' : 'Lock'}
            aria-pressed={locked}
            className={
              locked
                ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }
          >
            <LockIcon closed={locked} />
          </button>
        </Tooltip>
      ) : null}
      {onDelete ? (
        <>
          <Divider />
          <Tooltip
            title="Delete"
            description={
              locked ? 'Locked. Unlock it to delete.' : 'Delete this element (arrows too).'
            }
          >
            <button
              type="button"
              onClick={onDelete}
              disabled={locked}
              aria-label="Delete"
              className={
                locked
                  ? 'flex h-8 w-8 items-center justify-center rounded-md text-slate-300 dark:text-slate-600'
                  : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
              }
            >
              <TrashIcon />
            </button>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

function PopoverButton({
  label,
  description,
  onClick,
  children,
  active,
}: {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active ? true : undefined}
        className={
          active
            ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }
      >
        {children}
      </button>
    </Tooltip>
  );
}

function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

function PaintbrushIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 2.5l-6 6" />
      <path d="M7 8l1.5 1.5" />
      <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 13.5h6a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
    </svg>
  );
}

function UngroupIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}

function LockIcon({ closed }: { closed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
      {closed ? (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      ) : (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.4-.7" />
      )}
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  );
}
