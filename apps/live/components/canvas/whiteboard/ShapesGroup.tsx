'use client';

// The dock's Shapes group (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows", "Shape
// slots"): the pinned shapes, a separator, and Shapes, whose flyout holds the six slots and the
// search. A pinned shape arms its kind; dragged past the separator or off the bar it unpins; its
// menu (right-click, long-press, Shift+F10) does the same without a drag. Shapes dragged from the
// flyout land here, with a drop marker while they travel.

import { useRef } from 'react';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { useLongPress } from '@/hooks/ui/useLongPress';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { whiteboardShapeEntry, type WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { dropIndicatorX, PINNED_SHAPES_MAX, type SlotSource } from '@/lib/whiteboard-shape-slots';
import { DockButton, DockDivider, DockToolbar } from './DockToolbar';
import { ShapePreview, shapeShortcut } from './ShapePreview';
import type { DockFlyoutApi } from './useDockFlyout';
import type { ShapeSlotDragApi } from './useShapeSlotDrag';
import { ShapesGlyph } from './whiteboard-icons';

export const PINS_FULL_HINT = 'Seven shapes are pinned. Drag one out to swap.';

export function ShapesGroup({
  model,
  fly,
  slotDrag,
  refusing,
  pickAndClose,
}: {
  model: WhiteboardDockModel;
  fly: DockFlyoutApi;
  slotDrag: ShapeSlotDragApi;
  // The drag in progress would be refused (seven pinned, not onto one).
  refusing: boolean;
  pickAndClose: (pick: () => void) => void;
}) {
  const pinned = model.pinnedShapes;
  const { drag } = slotDrag;
  const armed = model.armedShape;
  // Any shape in hand (a catalogue shape, the sticky note included) that is not pinned.
  const shapeInHand =
    (model.tool === 'shape' || armed !== null) && !(armed !== null && pinned.includes(armed));

  const openPinMenu = (el: HTMLElement, key: WhiteboardShapeKey) => {
    if (slotDrag.isDragging()) return;
    fly.open('slot', el, { slot: { key, from: 'pinned' } });
  };

  // The drop marker, in px from the bar's left edge.
  const markX = drag ? dropIndicatorX(drag.layout, drag.source, drag.target) : null;
  const marker = drag && markX !== null ? markX - drag.layout.bar.left - 1 : null;

  return (
    <div className="relative flex shrink-0">
      <DockToolbar label="Shapes" group="shapes">
        {pinned.map((key) => (
          <PinnedShape
            key={key}
            shape={key}
            pressed={armed === key}
            dragged={drag?.source.key === key}
            // Ringed only where a full side would replace it; otherwise the marker shows the spot.
            dropOnto={
              drag?.target.zone === 'pinned' &&
              drag.target.onto === key &&
              drag.source.from === 'flyout' &&
              pinned.length >= PINNED_SHAPES_MAX
            }
            onPick={() => {
              if (slotDrag.consumeClick()) return;
              pickAndClose(() => model.pickShape(key));
            }}
            onPointerDown={slotDrag.onSlotPointerDown}
            onMenu={openPinMenu}
          />
        ))}
        <DockDivider data-pinned-separator="" />
        <DockButton
          itemKey="shapes"
          label="Shapes"
          shortcut={WHITEBOARD_TOOL_KEYS.shapes}
          icon={<ShapesGlyph />}
          pressed={shapeInHand}
          controls={{ id: 'whiteboard-flyout-shapes', expanded: fly.flyout?.kind === 'shapes' }}
          onHoverEnter={(el) => fly.hoverEnter('shapes', el)}
          onHoverLeave={fly.hoverLeave}
          onPress={(el) => fly.toggle('shapes', el)}
          // A press on the open flyout's button leaves the focus in its field (it took it on hover).
          extra={{
            onMouseDown: (e) => (fly.flyout?.kind === 'shapes' ? e.preventDefault() : undefined),
          }}
        />
      </DockToolbar>
      {marker !== null ? (
        <span
          aria-hidden
          data-slot-drop-indicator={refusing ? 'refused' : 'ok'}
          className={`pointer-events-none absolute top-1.5 h-9 w-0.5 rounded-full ${
            refusing ? 'bg-rose-500' : 'bg-brand-500'
          }`}
          style={{ left: marker }}
        />
      ) : null}
    </div>
  );
}

function PinnedShape({
  shape,
  pressed,
  dragged,
  dropOnto,
  onPick,
  onPointerDown,
  onMenu,
}: {
  shape: WhiteboardShapeKey;
  pressed: boolean;
  dragged: boolean;
  dropOnto: boolean;
  onPick: () => void;
  onPointerDown: (e: React.PointerEvent, source: SlotSource) => void;
  onMenu: (el: HTMLElement, key: WhiteboardShapeKey) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const longPressed = useRef(false);
  const longPress = useLongPress(() => {
    if (!ref.current) return;
    longPressed.current = true;
    onMenu(ref.current, shape);
  });
  const entry = whiteboardShapeEntry(shape);
  if (!entry) return null;
  return (
    <DockButton
      ref={ref}
      itemKey={`pinned:${shape}`}
      label={entry.label}
      icon={<ShapePreview entry={entry} />}
      // A pinned kind with a shape key shows it, as every dock tool does.
      shortcut={shapeShortcut(entry)}
      pressed={pressed}
      onPress={() => {
        // The release that ends a long-press opened the menu; it is not a pick.
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onPick();
      }}
      onContext={(el) => onMenu(el, shape)}
      className={`touch-none ${dragged ? 'opacity-40' : ''} ${dropOnto ? 'ring-2 ring-inset ring-brand-500' : ''}`}
      extra={{
        'data-slot-key': shape,
        'data-pinned-slot': '',
        onPointerDown: (e) => {
          longPressed.current = false;
          longPress.onPointerDown(e);
          onPointerDown(e, { key: shape, from: 'pinned' });
        },
        onKeyDown: (e) => {
          if (!((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu')) return;
          e.preventDefault();
          e.stopPropagation();
          onMenu(e.currentTarget, shape);
        },
      }}
    />
  );
}
