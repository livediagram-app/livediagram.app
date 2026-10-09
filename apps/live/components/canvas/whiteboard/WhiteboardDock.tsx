'use client';

// Draw mode's tools (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"): three
// groups, Drawing tools, Shapes and Settings (Undo and Redo live in the bottom bar), each its own
// toolbar with one Tab stop. The groups sit side by side in a floating bar at the top centre, or
// the bottom centre by choice ("Where the dock sits"), the strip's height at the toolbar UI scale;
// flyouts open on its board side; on a narrow screen the groups scroll sideways together. One
// flyout at a time, and nothing moves under the pointer when a tool is picked.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import type { WhiteboardDockPosition } from '@/lib/whiteboard-dock-prefs';
import { whiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import {
  pinFromMenu,
  resolveSlotDrop,
  splitPhonePins,
  unpinShape,
  type SlotOutcome,
  type SlotSource,
} from '@/lib/whiteboard-shape-slots';
import {
  EraserFlyoutBody,
  PenFlyoutBody,
  penFlyoutLabel,
  SettingsFlyoutBody,
  SlotMenuBody,
} from './dock-flyouts';
import { DrawingToolsGroup } from './DrawingToolsGroup';
import { SettingsGroup } from './SettingsGroup';
import { ShapesFlyout } from './ShapesFlyout';
import { PINS_FULL_HINT, ShapesGroup } from './ShapesGroup';
import { SlotGhost } from './SlotGhost';
import { useDockFlyout, type DockFlyout, type DockFlyoutApi } from './useDockFlyout';
import { useShapeSlotDrag } from './useShapeSlotDrag';
import { WhiteboardFlyout } from './WhiteboardFlyout';
import { debugLog } from '@/lib/debug-log';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';

// How long the "seven pinned" hint stays up.
const HINT_MS = 4000;

// Where the wrapper sits. At the top it keeps clear of the Explorer menu card (top-left, 12 + 98
// px with the editor mode switch beside the button, plus an 8px gap): beside it on a phone or a tablet, centred with the same clearance on both sides from lg
// (D33), so a tablet in portrait still shows the whole dock. Beside the card it starts 12px further
// in again (8.25rem), because its scroller bleeds 12px left for the groups' shadows (DockBody's
// `-m-3`): at 7.5rem that bleed reached under the card, and scrolled tools slid beneath it. At the
// bottom it is lifted above the bottom-right cluster (history, layers, zoom) until the viewport is
// wide enough for the two side by side (D9).
const WRAPPER_PLACEMENT: Record<WhiteboardDockPosition, string> = {
  top: 'top-3 left-[8.25rem] max-w-[calc(100%-9rem)] lg:left-1/2 lg:-translate-x-1/2 lg:max-w-[calc(100%-15rem)]',
  bottom:
    'bottom-[4.25rem] left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)] min-[1760px]:bottom-4',
};

export type WhiteboardDockProps = {
  model: WhiteboardDockModel;
  // The board's ink for this appearance: what the main pen draws with.
  ink: string;
};

export function WhiteboardDock({ model, ink }: WhiteboardDockProps) {
  // The dock is the Toolbar layout strip's twin, so it draws at the toolbar UI scale
  // (docs/specs/007-editor/ui-scale.md).
  const scale = useUiScale('toolbar');
  // A phone's dock: one pinned shape on the bar, the rest in the Shapes flyout, and no dragging
  // shapes on or off the bar (its drop targets would not match the pins it hides).
  const phone = useIsMobileViewport();
  const pins = phone
    ? splitPhonePins(model.pinnedShapes)
    : { onBar: model.pinnedShapes, inMenu: [] };
  // The canvas the stock colours are drawn for (docs/specs/007-editor/editor-modes.md "One look").
  const appearance = useCanvasSurface();
  const fly = useDockFlyout();

  // Where the dock is, logged only while one is shown: on mount and on every move.
  const { position } = model;
  useEffect(() => {
    debugLog('[whiteboard-dock] position', position);
  }, [position]);
  const [hint, setHint] = useState<{ left: number } | null>(null);

  // S asks for the Shapes flyout: opened as a hover opens it (its field focused, the focus going back
  // to the board when it closes); only Escape, a pick or a press elsewhere closes it.
  const { shapesRequest } = model;
  const seenRequest = useRef(shapesRequest);
  useEffect(() => {
    if (shapesRequest === seenRequest.current) return;
    seenRequest.current = shapesRequest;
    const opener = document.querySelector<HTMLElement>(
      '[data-whiteboard-dock] [data-dock-item="shapes"]',
    );
    if (!opener) return;
    if (fly.flyout?.kind === 'shapes') {
      document.querySelector<HTMLElement>('#whiteboard-flyout-shapes input')?.focus();
      return;
    }
    debugLog('[whiteboard-dock] Shapes flyout opened by S');
    fly.open('shapes', opener, { viaKey: true });
  }, [shapesRequest, fly]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(t);
  }, [hint]);

  const pickAndClose = (pick: () => void) => {
    fly.close();
    pick();
  };

  // "Seven shapes are pinned": beside the Shapes group (board side), where the refused shape
  // settles back.
  const showPinsFull = (group: HTMLElement | null) => {
    const wrap = group?.closest('[data-whiteboard-dock]')?.getBoundingClientRect();
    const box = group?.getBoundingClientRect();
    setHint({ left: wrap && box ? box.left + box.width / 2 - wrap.left : 0 });
  };

  const shapesBar = () =>
    document.querySelector<HTMLElement>('[data-whiteboard-dock] [data-dock-group="shapes"]');

  // A pin or an unpin, from a drop or a menu: a refusal writes nothing and shows the hint.
  const settle = (outcome: SlotOutcome) => {
    if (outcome.type === 'none') return;
    if (outcome.type === 'refused') {
      debugLog('[whiteboard-dock] pin refused: side full');
      showPinsFull(shapesBar());
      return;
    }
    model.applySlotOutcome(outcome);
  };

  // One drag for both sources: a flyout slot or result onto the pinned side, or a pinned shape off
  // it. The Shapes flyout stays open for the drag (no hover close) and closes once it lands.
  const slotDrag = useShapeSlotDrag({
    onStart: () => fly.stick(),
    onDrop: (source, target) => {
      const outcome = resolveSlotDrop(model.pinnedShapes, source, target);
      if (source.from === 'flyout' && outcome.type !== 'none') fly.close();
      settle(outcome);
    },
  });
  const { drag } = slotDrag;
  const refusing = drag
    ? resolveSlotDrop(model.pinnedShapes, drag.source, drag.target).type === 'refused'
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

  // Pin to dock (a flyout shape) or Unpin (a pinned one) from a menu: the limit and refusal of a drag.
  const chooseFromMenu = (slot: SlotSource) => {
    const outcome =
      slot.from === 'pinned'
        ? unpinShape(model.pinnedShapes, slot.key)
        : pinFromMenu(model.pinnedShapes, slot.key);
    fly.close(true);
    settle(outcome);
  };

  const flyoutContent = (
    f: DockFlyout,
  ): { label: string; body: ReactNode; hideTitle?: boolean } | null => {
    switch (f.kind) {
      case 'eraser':
        return { label: 'Eraser', body: <EraserFlyoutBody model={model} /> };
      case 'shapes':
        return {
          label: 'Shapes',
          hideTitle: true,
          body: (
            <ShapesFlyout
              ink={ink}
              slots={model.slotShapes}
              menuPins={pins.inMenu}
              canDrag={!phone}
              slotDrag={slotDrag}
              onPin={(key) => chooseFromMenu({ key, from: 'flyout' })}
              onEngage={fly.stick}
              onPick={(key, searched) =>
                pickAndClose(() => (searched ? model.pickSearchedShape(key) : model.pickShape(key)))
              }
            />
          ),
        };
      case 'settings':
        return {
          label: 'Settings',
          hideTitle: true,
          body: <SettingsFlyoutBody model={model} ink={ink} appearance={appearance} />,
        };
      case 'slot': {
        const slot = f.slot;
        const entry = slot ? whiteboardShapeEntry(slot.key) : undefined;
        if (!slot || !entry) return null;
        return {
          label: entry.label,
          body: (
            <SlotMenuBody pinned={slot.from === 'pinned'} onChoose={() => chooseFromMenu(slot)} />
          ),
        };
      }
      default: {
        const pen = model.prefs.pens.find((p) => p.id === f.kind);
        return pen
          ? { label: penFlyoutLabel(pen), body: <PenFlyoutBody pen={pen} model={model} /> }
          : null;
      }
    }
  };

  const open = fly.flyout ? flyoutContent(fly.flyout) : null;
  // Flyouts and the hint open on the board side: below a dock at the top.
  const below = model.position === 'top';

  const groups = (
    <>
      <DrawingToolsGroup model={model} ink={ink} fly={fly} pickAndClose={pickAndClose} />
      <ShapesGroup
        model={model}
        pinned={pins.onBar}
        canDrag={!phone}
        fly={fly}
        slotDrag={slotDrag}
        refusing={refusing}
        pickAndClose={pickAndClose}
      />
      <SettingsGroup fly={fly} />
      {drag ? (
        <SlotGhost dragKey={drag.source.key} x={drag.x} y={drag.y} refusing={refusing} />
      ) : null}
    </>
  );

  return (
    <div
      data-floating-panel=""
      data-whiteboard-dock=""
      data-dock-position={model.position}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={
        scale === 1
          ? undefined
          : {
              ...uiScaleStyle(scale),
              // Restated so the dock keeps its 12px from the edge however it is zoomed.
              ...(model.position === 'top' ? { top: toSurfacePx(12, scale) } : {}),
            }
      }
      className={`pointer-events-none absolute z-[var(--z-toolbar)] w-max ${WRAPPER_PLACEMENT[model.position]}`}
    >
      <DockBody below={below} hint={hint} fly={fly} open={open} groups={groups} />
    </div>
  );
}

type OpenFlyout = { label: string; body: ReactNode; hideTitle?: boolean } | null;

// The flyout in force, on the board side of the dock.
function DockFlyoutHost({
  fly,
  open,
  below,
}: {
  fly: DockFlyoutApi;
  open: OpenFlyout;
  below: boolean;
}) {
  if (!fly.flyout || !open) return null;
  return (
    <WhiteboardFlyout
      key={`${fly.flyout.kind}:${fly.flyout.openerKey}`}
      id={`whiteboard-flyout-${fly.flyout.kind}`}
      label={open.label}
      anchor={fly.flyout.openerKey}
      placement={below ? 'below' : 'above'}
      // The opener's offset in the dock: it changes when the groups scroll under an open flyout.
      revision={fly.flyout.left}
      onClose={fly.close}
      onPointerEnter={fly.cancelHoverClose}
      onPointerLeave={fly.hoverLeave}
      // The Shapes flyout's field takes the focus even on a hover, and gives it back on closing.
      takeFocus={!fly.flyout.hover || fly.flyout.kind === 'shapes'}
      restoreFocus={fly.flyout.viaHover}
      hideTitle={open.hideTitle}
    >
      {open.body}
    </WhiteboardFlyout>
  );
}

// The dock form: the groups side by side, scrolling together on a narrow screen.
function DockBody({
  below,
  hint,
  fly,
  open,
  groups,
}: {
  below: boolean;
  hint: { left: number } | null;
  fly: DockFlyoutApi;
  open: OpenFlyout;
  groups: ReactNode;
}) {
  return (
    <>
      <DockFlyoutHost fly={fly} open={open} below={below} />
      {hint ? (
        <p
          aria-hidden
          data-dock-hint=""
          data-side={below ? 'below' : 'above'}
          style={{ left: hint.left, translate: '-50% 0' }}
          className={`pointer-events-none absolute ${below ? 'top-full mt-2' : 'bottom-full mb-2'} w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900`}
        >
          {PINS_FULL_HINT}
        </p>
      ) : null}
      {/* Announced once, whatever the pointer is doing. */}
      <p role="status" className="sr-only">
        {hint ? PINS_FULL_HINT : ''}
      </p>
      {/* The groups scroll together on a narrow screen; the padding keeps their shadows
          unclipped. Scrolling moves the openers, so an open flyout follows its button. */}
      <div
        data-dock-scroller=""
        onScroll={fly.reanchor}
        className="-m-3 flex items-center gap-3 overflow-x-auto p-3 [scrollbar-width:none]"
      >
        {groups}
      </div>
    </>
  );
}
