import { useLayoutEffect, useRef, useState } from 'react';
import type { Tab } from '@livediagram/diagram';
import { TabLinkPicker } from './TabLinkPicker';
import { Tooltip } from './Tooltip';

type Bounds = { x: number; y: number; width: number; height: number };

type SelectionPopoverProps = {
  bounds: Bounds;
  canvasOffset: { x: number; y: number };
  zoom: number;
  locked: boolean;
  tabs: Tab[];
  currentTabId: string;
  linkedTabId: string | null;
  onToggleLock: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetLink: (tabId: string) => void;
  onClearLink: () => void;
  onCopyFormat?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onOpenComments?: () => void;
};

// The plus button sits between the popover and the element edge it
// belongs to. Bumped to 48 px so the plus has clear breathing room
// — at 36 px the popover crowded it and felt visually cramped.
const GAP = 48;
const EDGE_MARGIN = 8;

export function SelectionPopover({
  bounds,
  canvasOffset,
  zoom,
  locked,
  tabs,
  currentTabId,
  linkedTabId,
  onToggleLock,
  onDelete,
  onDuplicate,
  onSetLink,
  onClearLink,
  onCopyFormat,
  onGroup,
  onUngroup,
  onOpenComments,
}: SelectionPopoverProps) {
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Prefer above by default. After mount we measure and flip to
  // below only if there isn't room — checked in screen space, not
  // canvas space, because auto-fit puts most elements at negative
  // canvas-y, which made the old canvas-coord check always pick
  // "below".
  const [placeAbove, setPlaceAbove] = useState(true);

  const visualGap = GAP / zoom;
  const baseTop = placeAbove ? bounds.y - visualGap : bounds.y + bounds.height + visualGap;
  const baseLeft = bounds.x + bounds.width / 2;

  // After mount: (1) flip below if above doesn't fit in the viewport,
  // (2) nudge inside the viewport for edge cases. Both work off the
  // popover's own getBoundingClientRect so they account for the
  // outer canvas transform without needing to plumb it in.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    // Flip if the chosen direction doesn't fit; only flip once per
    // cycle so we don't oscillate when both directions are tight.
    if (placeAbove && rect.top < EDGE_MARGIN) {
      setPlaceAbove(false);
      return;
    }
    if (!placeAbove && rect.bottom > window.innerHeight - EDGE_MARGIN) {
      setPlaceAbove(true);
      return;
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
  }, [bounds.x, bounds.y, bounds.width, bounds.height, canvasOffset.x, canvasOffset.y, placeAbove]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute z-20 flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
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
      {/* Group: copy / duplicate the element itself. */}
      {onCopyFormat ? (
        <PopoverButton
          label="Copy formatting"
          description="Apply this size to the next click."
          onClick={onCopyFormat}
        >
          <PaintbrushIcon />
        </PopoverButton>
      ) : null}
      <PopoverButton
        label="Duplicate"
        description="Duplicate this element (arrows skipped)."
        onClick={onDuplicate}
      >
        <DuplicateIcon />
      </PopoverButton>

      <Divider />

      {/* Group: relationships (links to other tabs, grouping with other
          elements). The link-to-tab button is suppressed when the
          diagram only has one tab — there's nowhere to link to, so
          the button would be a dead end. Re-appears as soon as a
          second tab is added. */}
      {tabs.length > 1 ? (
        <>
          <Tooltip
            title={linkedTabId ? 'Edit link' : 'Link to tab'}
            description={linkedTabId ? 'Edit or clear the link.' : 'Pick a tab to link to.'}
          >
            <button
              ref={linkButtonRef}
              type="button"
              onClick={() => setLinkPickerOpen((v) => !v)}
              aria-label={linkedTabId ? 'Edit link' : 'Link to tab'}
              aria-pressed={linkedTabId !== null}
              className={
                linkedTabId
                  ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700'
                  : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
              }
            >
              <LinkIcon />
            </button>
          </Tooltip>
          {linkPickerOpen ? (
            <TabLinkPicker
              anchor={linkButtonRef.current}
              tabs={tabs}
              currentTabId={currentTabId}
              linkedTabId={linkedTabId}
              onSelect={(id) => {
                onSetLink(id);
                setLinkPickerOpen(false);
              }}
              onClear={() => {
                onClearLink();
                setLinkPickerOpen(false);
              }}
              onClose={() => setLinkPickerOpen(false)}
            />
          ) : null}
        </>
      ) : null}
      {onOpenComments ? (
        <PopoverButton
          label="Comments"
          description="Open the comment thread for this element."
          onClick={onOpenComments}
        >
          <CommentIcon />
        </PopoverButton>
      ) : null}

      <Divider />

      {/* Group: constraints on movement & resize. Group / Ungroup sits at
          the start of this cluster so it reads next to the aspect-lock
          button — grouping is the "lock these together" sibling of "lock
          the aspect ratio". */}
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
      <Divider />

      {/* Group: destructive (always last so it's not adjacent to anything benign). */}
      <Tooltip title="Delete" description="Delete this element (arrows too).">
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

function Divider() {
  return <div aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />;
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

function LinkIcon() {
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
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
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
