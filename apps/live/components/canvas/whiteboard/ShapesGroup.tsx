'use client';

// The dock's Shapes group (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows", "Shape
// slots"): Sticky note, Path tool, the pinned shapes, a separator, the two frequent slots, Shapes
// and More shapes. A slot arms its kind; dragged across the separator it pins or unpins; its menu
// (right-click, long-press, Shift+F10) does the same without a drag. The frequent slots hold still
// while a flyout is open or a slot is dragged, so nothing moves under the pointer mid-gesture.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShapePenIcon } from '@/components/palette/palette-icons';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { useLongPress } from '@/hooks/ui/useLongPress';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { WHITEBOARD_SHAPES } from '@/lib/whiteboard-tool';
import { whiteboardShapeEntry, type WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { dropIndicatorX, resolveSlotDrop, type SlotSource } from '@/lib/whiteboard-shape-slots';
import { DockButton, DockDivider, DockToolbar } from './DockToolbar';
import { ShapePreview } from './ShapePreview';
import type { DockFlyoutApi } from './useDockFlyout';
import { useShapeSlotDrag } from './useShapeSlotDrag';
import { DOCK_ICON_PX, MoreGlyph, ShapesGlyph, StickyGlyph } from './whiteboard-icons';

export const PINS_FULL_HINT = 'Two shapes are pinned. Drag one out to swap.';

const FLYOUT_SHAPES = new Set<WhiteboardShapeKey>(WHITEBOARD_SHAPES.map((s) => s.id));

// The value shown while `frozen`: the last one seen before it froze.
function useHeldWhile<T>(value: readonly T[], frozen: boolean): readonly T[] {
  const [shown, setShown] = useState(value);
  const same = shown.length === value.length && shown.every((v, i) => v === value[i]);
  if (!frozen && !same) setShown(value);
  return frozen ? shown : value;
}

export function ShapesGroup({
  model,
  fly,
  pickAndClose,
  onRefused,
}: {
  model: WhiteboardDockModel;
  fly: DockFlyoutApi;
  pickAndClose: (pick: () => void) => void;
  // A pin the limit refuses: the dock shows the hint above this group.
  onRefused: (group: HTMLElement | null) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pinned = model.pinnedShapes;

  const settle = (outcome: ReturnType<typeof resolveSlotDrop>) => {
    if (outcome.type === 'refused') {
      console.debug('[whiteboard-dock] pin refused: two pinned');
      onRefused(groupRef.current);
      return;
    }
    model.applySlotOutcome(outcome);
  };

  const { drag, onSlotPointerDown, consumeClick, isDragging } = useShapeSlotDrag({
    groupRef,
    onDrop: (source, target) => settle(resolveSlotDrop(pinned, source, target)),
  });
  const frequent = useHeldWhile(model.frequentShapes, fly.flyout !== null || drag !== null);

  const refusing = drag
    ? resolveSlotDrop(pinned, drag.source, drag.target).type === 'refused'
    : false;
  // The pointer says what a release would do.
  useEffect(() => {
    if (!drag) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = refusing ? 'not-allowed' : 'grabbing';
    return () => {
      document.body.style.cursor = prev;
    };
  }, [drag, refusing]);

  const openSlotMenu = (el: HTMLElement, source: SlotSource) => {
    if (isDragging()) return;
    fly.open('slot', el, { slot: source });
  };

  const onBar = new Set<WhiteboardShapeKey>([...pinned, ...frequent]);
  const armed = model.armedShape;
  const armedOnBar = armed !== null && onBar.has(armed);
  const shapeInHand = model.tool === 'shape' && !armedOnBar;

  const slot = (key: WhiteboardShapeKey, from: SlotSource['from']) => (
    <ShapeSlot
      key={`${from}:${key}`}
      source={{ key, from }}
      pressed={armed === key}
      dragged={drag?.source.key === key}
      dropOnto={drag?.target.zone === 'pinned' && drag.target.onto === key}
      onPick={() => {
        if (consumeClick()) return;
        pickAndClose(() => model.pickShape(key));
      }}
      onPointerDown={onSlotPointerDown}
      onMenu={openSlotMenu}
    />
  );

  // The bar, in px from the group's left edge.
  const barX = drag ? dropIndicatorX(drag.layout, drag.source, drag.target) : null;
  const indicator = drag && barX !== null ? barX - drag.groupLeft - 1 : null;

  return (
    <div ref={groupRef} className="relative flex shrink-0">
      <DockToolbar label="Shapes" group="shapes">
        <DockButton
          itemKey="sticky"
          label="Sticky note"
          shortcut={WHITEBOARD_TOOL_KEYS.sticky}
          icon={<StickyGlyph />}
          pressed={model.tool === 'sticky'}
          onPress={() => pickAndClose(model.pickSticky)}
        />
        {/* The Path tool (docs/specs/023-whiteboard/path-tool.md), in the Shape Pen's own icon. */}
        <DockButton
          itemKey="path"
          label="Path tool"
          shortcut={WHITEBOARD_TOOL_KEYS.path}
          icon={<ShapePenIcon size={DOCK_ICON_PX} />}
          pressed={model.tool === 'path'}
          onPress={() => pickAndClose(model.pickPath)}
        />
        {pinned.map((key) => slot(key, 'pinned'))}
        <DockDivider data-slot-separator="" />
        {frequent.map((key) => slot(key, 'frequent'))}
        <DockButton
          itemKey="shapes"
          label="Shapes"
          icon={<ShapesGlyph />}
          pressed={shapeInHand && (armed === null || FLYOUT_SHAPES.has(armed))}
          controls={{ id: 'whiteboard-flyout-shapes', expanded: fly.flyout?.kind === 'shapes' }}
          onHoverEnter={(el) => fly.hoverEnter('shapes', el)}
          onHoverLeave={fly.hoverLeave}
          onPress={(el) => fly.toggle('shapes', el)}
        />
        <DockButton
          itemKey="search"
          label="More shapes"
          icon={<MoreGlyph />}
          pressed={shapeInHand && armed !== null && !FLYOUT_SHAPES.has(armed)}
          controls={{ id: 'whiteboard-flyout-search', expanded: fly.flyout?.kind === 'search' }}
          onPress={(el) => fly.toggle('search', el)}
        />
      </DockToolbar>
      {indicator !== null ? (
        <span
          aria-hidden
          data-slot-drop-indicator={refusing ? 'refused' : 'ok'}
          className={`pointer-events-none absolute top-1.5 h-9 w-0.5 rounded-full ${
            refusing ? 'bg-rose-500' : 'bg-brand-500'
          }`}
          style={{ left: indicator }}
        />
      ) : null}
      {drag ? (
        <SlotGhost dragKey={drag.source.key} x={drag.x} y={drag.y} refusing={refusing} />
      ) : null}
    </div>
  );
}

function ShapeSlot({
  source,
  pressed,
  dragged,
  dropOnto,
  onPick,
  onPointerDown,
  onMenu,
}: {
  source: SlotSource;
  pressed: boolean;
  dragged: boolean;
  dropOnto: boolean;
  onPick: () => void;
  onPointerDown: (e: React.PointerEvent, source: SlotSource) => void;
  onMenu: (el: HTMLElement, source: SlotSource) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const longPressed = useRef(false);
  const longPress = useLongPress(() => {
    if (!ref.current) return;
    longPressed.current = true;
    onMenu(ref.current, source);
  });
  const entry = whiteboardShapeEntry(source.key);
  if (!entry) return null;
  return (
    <DockButton
      ref={ref}
      itemKey={`${source.from}:${source.key}`}
      label={entry.label}
      icon={<ShapePreview entry={entry} />}
      pressed={pressed}
      onPress={() => {
        // The release that ends a long-press opened the menu; it is not a pick.
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onPick();
      }}
      onContext={(el) => onMenu(el, source)}
      className={`touch-none ${dragged ? 'opacity-40' : ''} ${dropOnto ? 'ring-2 ring-inset ring-brand-500' : ''}`}
      extra={{
        'data-slot-key': source.key,
        'data-pinned-slot': source.from === 'pinned' ? '' : undefined,
        'data-frequent-slot': source.from === 'frequent' ? '' : undefined,
        onPointerDown: (e) => {
          longPressed.current = false;
          longPress.onPointerDown(e);
          onPointerDown(e, source);
        },
        onKeyDown: (e) => {
          if (!((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu')) return;
          e.preventDefault();
          e.stopPropagation();
          onMenu(e.currentTarget, source);
        },
      }}
    />
  );
}

// The slot under the pointer while it is dragged; outside the dock so the dock's own transform and
// scroll never clip or offset it.
function SlotGhost({
  dragKey,
  x,
  y,
  refusing,
}: {
  dragKey: WhiteboardShapeKey;
  x: number;
  y: number;
  refusing: boolean;
}) {
  const entry = whiteboardShapeEntry(dragKey);
  if (!entry || typeof document === 'undefined') return null;
  return createPortal(
    <span
      aria-hidden
      data-slot-ghost={dragKey}
      className={`pointer-events-none fixed z-[var(--z-toolbar)] flex h-11 w-11 items-center justify-center rounded-lg border bg-white text-slate-700 shadow-lg dark:bg-slate-900 dark:text-slate-200 ${
        refusing ? 'border-rose-500' : 'border-brand-500'
      }`}
      style={{ left: x - 22, top: y - 22 }}
    >
      <ShapePreview entry={entry} />
    </span>,
    document.body,
  );
}
