import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';

type Bounds = { x: number; y: number; width: number; height: number };

type SelectionPopoverProps = {
  bounds: Bounds;
  canvasOffset: { x: number; y: number };
  zoom: number;
  locked: boolean;
  aspectLocked: boolean;
  onToggleLock: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyFormat?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onToggleAspectLock?: () => void;
};

const POPOVER_HEIGHT = 44;
const GAP = 8;
const EDGE_MARGIN = 8;

export function SelectionPopover({
  bounds,
  canvasOffset,
  zoom,
  locked,
  aspectLocked,
  onToggleLock,
  onDelete,
  onDuplicate,
  onCopyFormat,
  onGroup,
  onUngroup,
  onToggleAspectLock,
}: SelectionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initial layout-time position: above if there's room, otherwise below.
  // Gap is divided by zoom so the on-screen gap stays constant.
  const visualGap = GAP / zoom;
  const placeAbove = bounds.y >= POPOVER_HEIGHT / zoom + visualGap;
  const baseTop = placeAbove
    ? bounds.y - visualGap
    : bounds.y + bounds.height + visualGap;
  const baseLeft = bounds.x + bounds.width / 2;

  // After mount, measure the popover and nudge it so it stays inside the
  // viewport. Without this, popovers on elements near the screen edge get
  // clipped (their natural -translate-x-1/2 ignores viewport bounds).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
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
  }, [bounds.x, bounds.y, bounds.width, bounds.height, canvasOffset.x, canvasOffset.y]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
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
      {onCopyFormat ? (
        <PopoverButton
          label="Copy formatting"
          description="Apply this element's size to the next element you click."
          onClick={onCopyFormat}
        >
          <PaintbrushIcon />
        </PopoverButton>
      ) : null}
      <PopoverButton
        label="Duplicate"
        description="Make a copy of this element next to the original. Arrows are not duplicated."
        onClick={onDuplicate}
      >
        <DuplicateIcon />
      </PopoverButton>
      {onUngroup ? (
        <PopoverButton
          label="Ungroup"
          description="Break this group apart so members move independently."
          onClick={onUngroup}
        >
          <UngroupIcon />
        </PopoverButton>
      ) : onGroup ? (
        <PopoverButton
          label="Group with another"
          description="Click other elements to add them to a group with this one."
          onClick={onGroup}
        >
          <GroupIcon />
        </PopoverButton>
      ) : null}
      {onToggleAspectLock ? (
        <Tooltip
          title={aspectLocked ? 'Aspect ratio locked' : 'Lock aspect ratio'}
          description={
            aspectLocked
              ? 'Click to unlock so width and height resize independently.'
              : 'When on, resizing keeps the element’s width-to-height ratio.'
          }
        >
          <button
            type="button"
            onClick={onToggleAspectLock}
            aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            aria-pressed={aspectLocked}
            className={
              aspectLocked
                ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700'
                : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
            }
          >
            <AspectLockIcon closed={aspectLocked} />
          </button>
        </Tooltip>
      ) : null}
      <Tooltip
        title={locked ? 'Unlock' : 'Lock'}
        description={
          locked
            ? 'Allow this element to be moved and resized again.'
            : 'Prevent accidental moves and resizes. You can still delete or unlock.'
        }
      >
        <button
          type="button"
          onClick={onToggleLock}
          aria-label={locked ? 'Unlock' : 'Lock'}
          aria-pressed={locked}
          className={
            locked
              ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700'
              : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
          }
        >
          <LockIcon closed={locked} />
        </button>
      </Tooltip>
      <Tooltip title="Delete" description="Remove this element. Connected arrows are removed too.">
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
        >
          <TrashIcon />
        </button>
      </Tooltip>
    </div>
  );
}

function PopoverButton({
  label,
  description,
  onClick,
  children,
}: {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 13.5h6a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

function PaintbrushIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 2.5l-6 6" />
      <path d="M7 8l1.5 1.5" />
      <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
    </svg>
  );
}

function UngroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}

function AspectLockIcon({ closed }: { closed: boolean }) {
  // A small square with corner arrows + a tiny lock indicator when closed.
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
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      {closed ? (
        <path d="M5.5 5.5l1.5 1.5M10.5 10.5l-1.5-1.5M5.5 10.5l1.5-1.5M10.5 5.5l-1.5 1.5" />
      ) : (
        <path d="M5.5 5.5l2 2M10.5 10.5l-2-2" />
      )}
    </svg>
  );
}

function LockIcon({ closed }: { closed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
      {closed ? (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      ) : (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.4-.7" />
      )}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  );
}
