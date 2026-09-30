'use client';

// The whiteboard's floating dock (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// four groups side by side at the bottom centre, in place of the palette: Drawing tools, Shapes
// (only in the With shapes mode), History and Settings. Each group is its own
// toolbar with one Tab stop.
// Flyouts open ABOVE the dock, one at a time, so nothing moves under the pointer when a tool is
// picked; on a narrow screen the groups scroll sideways together.

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useAppearance } from '@/hooks/ui/useAppearance';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { whiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import {
  pinFromMenu,
  resolveSlotDrop,
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
import { HistoryGroup } from './HistoryGroup';
import { SettingsGroup } from './SettingsGroup';
import { ShapesFlyout } from './ShapesFlyout';
import { PINS_FULL_HINT, ShapesGroup } from './ShapesGroup';
import { SlotGhost } from './SlotGhost';
import { SHAPES_GROUP_FLYOUTS, useDockFlyout, type DockFlyout } from './useDockFlyout';
import { useShapeSlotDrag } from './useShapeSlotDrag';
import { WhiteboardFlyout } from './WhiteboardFlyout';

// How long the "seven pinned" hint stays up.
const HINT_MS = 4000;

export type WhiteboardDockProps = {
  model: WhiteboardDockModel;
  // The board's ink for this appearance: what the main pen draws with.
  ink: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function WhiteboardDock({
  model,
  ink,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: WhiteboardDockProps) {
  const { appearance } = useAppearance();
  const fly = useDockFlyout();
  const [hint, setHint] = useState<{ left: number } | null>(null);
  const showShapes = model.dockMode === 'shapes';

  // A flyout of a group that goes (Simple mode, maybe from another device) closes with it.
  const flyoutKind = fly.flyout?.kind;
  useEffect(() => {
    if (!showShapes && flyoutKind && SHAPES_GROUP_FLYOUTS.includes(flyoutKind)) fly.close();
  }, [showShapes, flyoutKind, fly]);

  // The mode changes which groups show: the Settings flyout (open while the mode is chosen) follows
  // its cog to where the re-centred dock put it.
  const { reanchor } = fly;
  useLayoutEffect(() => {
    reanchor();
    // Only a mode switch moves the openers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.dockMode]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(t);
  }, [hint]);

  const pickAndClose = (pick: () => void) => {
    fly.close();
    pick();
  };

  // "Seven shapes are pinned": above the Shapes group, where the refused shape settles back.
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
      console.debug('[whiteboard-dock] pin refused: side full');
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

  return (
    <div
      data-floating-panel=""
      data-whiteboard-dock=""
      data-dock-mode={model.dockMode}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // Centred, and lifted above the bottom-right cluster (history, layers, zoom) until the
      // viewport is wide enough for the two side by side (D9).
      className="pointer-events-none absolute bottom-[4.25rem] left-1/2 z-[var(--z-toolbar)] w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 min-[1760px]:bottom-4"
    >
      {fly.flyout && open ? (
        <WhiteboardFlyout
          key={`${fly.flyout.kind}:${fly.flyout.openerKey}`}
          id={`whiteboard-flyout-${fly.flyout.kind}`}
          label={open.label}
          left={fly.flyout.left}
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
      ) : null}
      {hint ? (
        <p
          aria-hidden
          data-dock-hint=""
          style={{ left: hint.left, translate: '-50% 0' }}
          className="pointer-events-none absolute bottom-full mb-2 w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {PINS_FULL_HINT}
        </p>
      ) : null}
      {/* Announced once, whatever the pointer is doing. */}
      <p role="status" className="sr-only">
        {hint ? PINS_FULL_HINT : ''}
      </p>
      {/* The groups scroll together on a narrow screen; the padding keeps their shadows unclipped.
          Scrolling moves the openers, so an open flyout follows its button. */}
      <div
        data-dock-scroller=""
        onScroll={fly.reanchor}
        className="-m-3 flex items-center gap-3 overflow-x-auto p-3 [scrollbar-width:none]"
      >
        <DrawingToolsGroup model={model} ink={ink} fly={fly} pickAndClose={pickAndClose} />
        {showShapes ? (
          <ShapesGroup
            model={model}
            fly={fly}
            slotDrag={slotDrag}
            refusing={refusing}
            pickAndClose={pickAndClose}
          />
        ) : null}
        <HistoryGroup canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
        <SettingsGroup fly={fly} />
        {drag ? (
          <SlotGhost dragKey={drag.source.key} x={drag.x} y={drag.y} refusing={refusing} />
        ) : null}
      </div>
    </div>
  );
}
