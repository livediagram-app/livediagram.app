import { useRef, type ReactNode } from 'react';
import { useEdgeAwarePlacement } from '@liveworkspace/workbench/hooks/canvas/useEdgeAwarePlacement';
import { FloatingTitle } from '@liveworkspace/workbench/components/chrome/FloatingTitle';
import { DuplicateIcon, TrashIcon, HoverCard } from '@livehuddle/ui';
import { EllipsisIcon } from '@liveworkspace/workbench/components/canvas/selection-popover-icons';
import { ImageGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { Divider, PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import type { Rect } from '@livehuddle/document';

type SelectionPopoverProps = {
  bounds: Rect;
  canvasOffset: { x: number; y: number };
  zoom: number;
  // Hidden while the selection moves: measures nothing until it ends (useEdgeAwarePlacement).
  suspended?: boolean;
  // Omitted in read-only / view-role mode, which suppresses the Delete button.
  onDelete?: () => void;
  // Duplicate the selected element, a one-click toolbar action (it used to
  // live only in the right-click context menu). Omitted in read-only /
  // view-role mode.
  onDuplicate?: () => void;
  // Open the same context menu that a right-click on the element
  // would open, anchored under the ellipsis button. Surfaces the
  // full action list on touch devices that can't right-click.
  onOpenContextMenu?: (screenX: number, screenY: number) => void;
  // A Poster's picture (docs/specs/009-elements/poster.md "Choosing its picture"): opens the image picker for it. An
  // Editor's alone; `pictureLabel` says Choose or Change.
  onChoosePicture?: () => void;
  pictureLabel?: string;
  // Small caption above (or below) the toolbar naming what's selected
  // ("Selected Square", "Selected Element").
  title?: string;
  // Tighter gap between the popover and the element edge, set whenever
  // the "+" quick-connect button (which sits in this gap) doesn't render:
  // read-only, or a kind that shows none (an
  // annotation), so the toolbar sits closer without overlapping anything.
  compact?: boolean;
  // A separate small toolbar to the left of this one (the element tour offer, away from Delete at the right end,
  // docs/specs/007-editor/element-tours.md), placed and nudged with it as one group.
  aside?: ReactNode;
  // The piece a fresh duplicate came from, in canvas units: the popover keeps off it (canvas-and-palette.md "Selection
  // popover", Work Tracker 849).
  avoid?: Rect | null;
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
  onDelete,
  onDuplicate,
  onOpenContextMenu,
  onChoosePicture,
  pictureLabel = 'Choose Picture',
  compact = false,
  suspended = false,
  title,
  aside,
  avoid = null,
}: SelectionPopoverProps) {
  const ellipsisRef = useRef<HTMLButtonElement>(null);
  // More opens the element menu on every device: right-click is not something a desktop user finds,
  // and touch can't right-click (docs/specs/008-canvas/canvas-and-palette.md#selection-popover).
  const showMore = !!onOpenContextMenu;
  const showDelete = !!onDelete;
  // Counter-scaled placement: the popover renders at its natural on-screen size
  // regardless of zoom, pinned to the selection's nearest centre edge.
  const { ref, placeAbove, style } = useEdgeAwarePlacement(
    bounds,
    canvasOffset,
    zoom,
    (compact ? GAP_COMPACT : GAP_DEFAULT) / zoom,
    suspended,
    avoid,
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
        // Its 32px buttons sit 4px apart: on a touch screen each tap area is 44px both ways, drawn behind the buttons
        // (touch-target-packed in this stacking context, touch-targets.md), so a drawn button always wins its own box.
        className="pointer-events-auto relative max-w-[95vw] animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 isolate [&_.h-8]:relative [&_.h-8]:touch-target-packed"
      >
        {title ? <FloatingTitle title={title} placeAbove={placeAbove} /> : null}
        {/* The toolbar is at most 95vw wide; its buttons ride a strip that scrolls sideways when they outgrow it (a
          flowchart step's full set on a phone). The strip reaches 6px past the buttons top and bottom, so their 44px
          tap pads are not clipped, and it is not positioned, so a dropdown's menu anchors to the card and escapes its
          clip. */}
        {/* `isolate` makes the strip a stacking context of its own, so the pads draw over it rather than under it: without it a
          tap just above or below a button landed on the strip (iPad). Isolation does not position it. */}
        <div
          data-testid="selection-popover-strip"
          className="isolate -my-1.5 flex touch-pan-x items-center gap-1 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none]"
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

          {onChoosePicture ? (
            <>
              <PopoverButton
                label={pictureLabel}
                description="Upload a picture, pick one from your gallery or search."
                onClick={onChoosePicture}
              >
                <ImageGlyph />
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

          {showDelete ? (
            <>
              <HoverCard title="Delete" description="Delete this element.">
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Delete"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
