import { useRef } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useEdgeAwarePlacement } from '@/hooks/canvas/useEdgeAwarePlacement';
import { FloatingTitle } from '@/components/chrome/FloatingTitle';
import {
  CommentIcon,
  DuplicateIcon,
  EllipsisIcon,
  GroupIcon,
  LockIcon,
  TextIcon,
  TrashIcon,
  UngroupIcon,
} from '@/components/canvas/selection-popover-icons';

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
  // Enter inline text-edit mode on the selected element. Passed for every
  // text-CAPABLE element (see elementSupportsText) — including ones with no
  // label yet, so the button itself teaches that text can be added. Absent
  // for kinds with no label (tables, images, annotations, data shapes).
  onEditText?: () => void;
  // True when the element already has text: the button reads "Edit text";
  // false = "Add text". Defaults to edit for older callers.
  hasText?: boolean;
  // Duplicate the selected element, a one-click toolbar action (it used to
  // live only in the right-click context menu). Omitted in read-only /
  // view-role mode.
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
  // Small caption above (or below) the toolbar naming what's selected
  // ("Selected Element" / "Selected Group").
  title?: string;
  // Tighter gap between the popover and the element edge. Set
  // by the view-role caller because the plus duplicate button
  // (which sits in this gap for editor sessions) doesn't render
  // when read-only, so the toolbar can sit closer to the element
  // without overlapping anything.
  compact?: boolean;
};

// Default gap: leave room for the plus duplicate button between
// the popover and the element edge. Bumped to 48 px so the plus
// has clear breathing room (at 36 px the popover crowded it and
// felt visually cramped). `compact` callers (view-role) drop to
// 16 px since there's no plus button to clear.
const GAP_DEFAULT = 48;
const GAP_COMPACT = 16;

export function SelectionPopover({
  bounds,
  canvasOffset,
  zoom,
  locked = false,
  onToggleLock,
  onDelete,
  onEditText,
  hasText = true,
  onDuplicate,
  onGroup,
  onUngroup,
  onOpenComments,
  onOpenContextMenu,
  compact = false,
  title,
}: SelectionPopoverProps) {
  const ellipsisRef = useRef<HTMLButtonElement>(null);
  // Counter-scaled placement: the popover renders at its natural on-screen size
  // regardless of zoom, pinned to the selection's nearest centre edge.
  const { ref, placeAbove, style } = useEdgeAwarePlacement(
    bounds,
    canvasOffset,
    zoom,
    (compact ? GAP_COMPACT : GAP_DEFAULT) / zoom,
  );

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto absolute z-[var(--z-toolbar)] flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={style}
    >
      {title ? <FloatingTitle title={title} placeAbove={placeAbove} /> : null}
      {onOpenContextMenu ? (
        <>
          <Tooltip title="More" description="Open the element menu.">
            <button
              ref={ellipsisRef}
              type="button"
              data-context-menu-trigger
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

      {onEditText ? (
        <>
          <PopoverButton
            label={hasText ? 'Edit text' : 'Add text'}
            description={hasText ? "Edit this element's text." : 'Give this element a text label.'}
            onClick={onEditText}
          >
            <TextIcon />
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
                  ? 'flex h-8 w-8 items-center justify-center rounded-md text-slate-300 dark:text-slate-400'
                  : 'flex h-8 w-8 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
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
