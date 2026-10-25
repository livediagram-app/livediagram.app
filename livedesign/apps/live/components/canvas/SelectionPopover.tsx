import { useRef, type ReactNode } from 'react';
import { useEdgeAwarePlacement } from '@/hooks/canvas/useEdgeAwarePlacement';
import { FloatingTitle } from '@liveworkspace/workbench/components/chrome/FloatingTitle';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import {
  useMinimalChrome,
  usePowerUser,
} from '@liveworkspace/workbench/components/providers/minimal-chrome';
import { CommentIcon, DuplicateIcon, LockIcon, TrashIcon, HoverCard } from '@livedesign/ui';
import {
  BringToFrontIcon,
  EllipsisIcon,
  SendToBackIcon,
  TextIcon,
} from '@/components/canvas/selection-popover-icons';
import { EditPointsIcon } from '@/components/palette/palette-icons';
import { Divider, PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import type { Rect } from '@livedesign/design';

type SelectionPopoverProps = {
  bounds: Rect;
  canvasOffset: { x: number; y: number };
  zoom: number;
  // Hidden while the selection moves: measures nothing until it ends (useEdgeAwarePlacement).
  suspended?: boolean;
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
  // True when the element already has text: the button reads "Edit Text";
  // false = "Add Text". Defaults to edit for older callers.
  hasText?: boolean;
  // Open a path's edit mode (docs/specs/023-draw-mode/path-tool.md "Editing"): a path only.
  onEditPoints?: () => void;
  // Duplicate the selected element, a one-click toolbar action (it used to
  // live only in the right-click context menu). Omitted in read-only /
  // view-role mode.
  onDuplicate?: () => void;
  // Intra-LAYER z-order (docs/specs/006-design/layers.md gained no z-nudge until now): stack this
  // element in front of / behind its band-mates WITHOUT moving it between
  // layers, which is what the element menu's Bring to Front does.
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  // Open the comment thread. The toolbar shows the Comment button
  // whenever this is passed, regardless of any other props, which
  // is how view-role visitors get the comments-only toolbar (no
  // edit affordances next to it).
  onOpenComments?: () => void;
  // Someone who may comment adds one; a Viewer only reads the thread there is (docs/specs/013-workspace/share-roles.md).
  commentsReadOnly?: boolean;
  // Open the same context menu that a right-click on the element
  // would open, anchored under the ellipsis button. Surfaces the
  // full action list on touch devices that can't right-click.
  onOpenContextMenu?: (screenX: number, screenY: number) => void;
  // Small caption above (or below) the toolbar naming what's selected
  // ("Selected Square", "Selected Element").
  title?: string;
  // Tighter gap between the popover and the element edge, set whenever
  // the "+" quick-connect button (which sits in this gap) doesn't render:
  // read-only, or a kind that shows none (a Plan board or card, an
  // annotation), so the toolbar sits closer without overlapping anything.
  compact?: boolean;
  // A separate small toolbar to the left of this one (the element tour offer, away from Delete at the right end,
  // docs/specs/007-editor/element-tours.md), placed and nudged with it as one group.
  aside?: ReactNode;
};

// Default gap: leave room for the plus duplicate button between
// the popover and the element edge. Bumped to 48 px so the plus
// has clear breathing room (at 36 px the popover crowded it and
// felt visually cramped). `compact` callers (no "+" showing) drop to
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
  onEditPoints,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onOpenComments,
  commentsReadOnly = false,
  onOpenContextMenu,
  compact = false,
  suspended = false,
  title,
  aside,
}: SelectionPopoverProps) {
  const ellipsisRef = useRef<HTMLButtonElement>(null);
  // More opens the element menu: on every device, since right-click is not something a desktop
  // user finds, except in power user mode, where right-click is the way in. Touch can't
  // right-click, so it always keeps it. The bin goes only with Minimal chrome on desktop, where
  // Delete is the key (docs/specs/008-canvas/canvas-and-palette.md#selection-popover).
  const touch = useCoarsePointer();
  const minimalChrome = useMinimalChrome();
  const powerUser = usePowerUser();
  const showMore = !!onOpenContextMenu && (touch || !powerUser);
  const showDelete = !!onDelete && (touch || !minimalChrome);
  // Counter-scaled placement: the popover renders at its natural on-screen size
  // regardless of zoom, pinned to the selection's nearest centre edge.
  const { ref, placeAbove, style } = useEdgeAwarePlacement(
    bounds,
    canvasOffset,
    zoom,
    (compact ? GAP_COMPACT : GAP_DEFAULT) / zoom,
    suspended,
  );

  // The toolbar, and any aside before it, ride one positioned group: placed, flipped and nudged inside the canvas
  // together. The aside leads, at the left, so it never sits beside Delete and the More at the toolbar's right end.
  // The group is as wide as its content up to the screen less its margins; past that the aside wraps onto its own
  // line on the far side from the element (above the toolbar when it sits above), never over it: being first, it
  // takes the first line, which wrap-reverse puts at the bottom when the group sits below the element.
  return (
    <div
      ref={ref}
      // A toolbar over the canvas: a held tool's press there is a button press (usePathTool).
      data-canvas-toolbar=""
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`pointer-events-none absolute z-[var(--z-toolbar)] flex w-max max-w-[calc(100vw-1rem)] items-center justify-center gap-x-2 gap-y-7 ${placeAbove ? 'flex-wrap' : 'flex-wrap-reverse'}`}
      style={style}
    >
      {aside}
      <div
        data-testid="selection-popover"
        role="toolbar"
        aria-label={title}
        // Its 32px buttons sit 4px apart, so on a touch screen each tap area reaches to 44px tall only
        // (touch-target-y, touch-targets.md), never sideways into its neighbour's.
        className="pointer-events-auto relative max-w-[95vw] animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 [&_.h-8]:relative [&_.h-8]:touch-target-y"
      >
        {title && !minimalChrome ? <FloatingTitle title={title} placeAbove={placeAbove} /> : null}
        {/* The toolbar is at most 95vw wide; its buttons ride a strip that scrolls sideways when they outgrow it (on a
          phone). The strip reaches 6px past the buttons top and bottom, so their 44px
          tap pads are not clipped. */}
        <div
          data-testid="selection-popover-strip"
          className="-my-1.5 flex touch-pan-x items-center gap-1 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none]"
        >
          {showMore && onOpenContextMenu ? (
            <>
              <HoverCard title="More" description="Open the element menu.">
                <button
                  ref={ellipsisRef}
                  // A stable id: this toolbar unmounts while the element menu it opens is up, and
                  // the menu's Escape finds it again by id (docs/specs/004-interface-design/menus.md).
                  id="selection-more-actions"
                  type="button"
                  data-context-menu-trigger
                  onClick={() => {
                    const rect = ellipsisRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    onOpenContextMenu(rect.left, rect.bottom);
                  }}
                  aria-label="More actions"
                  aria-haspopup="dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <EllipsisIcon />
                </button>
              </HoverCard>
              <Divider />
            </>
          ) : null}

          {onEditText ? (
            <>
              <PopoverButton
                label={hasText ? 'Edit Text' : 'Add Text'}
                description={
                  hasText ? "Edit this element's text." : 'Give this element a text label.'
                }
                onClick={onEditText}
              >
                <TextIcon />
              </PopoverButton>
              <Divider />
            </>
          ) : null}

          {onEditPoints ? (
            <>
              <PopoverButton
                label="Edit Points"
                description="Adjust the path's points, corners and curves."
                onClick={onEditPoints}
              >
                <EditPointsIcon />
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

          {onBringToFront && onSendToBack ? (
            <>
              <PopoverButton
                label="Bring to Front"
                description="Stack this in front of everything else on its layer."
                onClick={onBringToFront}
              >
                <BringToFrontIcon />
              </PopoverButton>
              <PopoverButton
                label="Send to Back"
                description="Stack this behind everything else on its layer."
                onClick={onSendToBack}
              >
                <SendToBackIcon />
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
              label={commentsReadOnly ? 'Show Comments' : 'Add Comment'}
              description={
                commentsReadOnly
                  ? 'Read the comments on this element.'
                  : 'Open the comment thread for this element.'
              }
              onClick={onOpenComments}
            >
              <CommentIcon />
            </PopoverButton>
          ) : null}

          {onToggleLock ? (
            <HoverCard
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
            </HoverCard>
          ) : null}
          {showDelete ? (
            <>
              <HoverCard
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
                      : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }
                >
                  <TrashIcon />
                </button>
              </HoverCard>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
