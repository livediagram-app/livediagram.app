'use client';

// The whiteboard's floating dock (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// three groups side by side at the bottom centre, in place of the palette: Drawing tools, History
// and Shapes (Shapes only in the With shapes mode). Each group is its own toolbar with one Tab stop.
// Flyouts open ABOVE the dock, one at a time, so nothing moves under the pointer when a tool is
// picked; on a narrow screen the groups scroll sideways together.

import { useEffect, useState, type ReactNode } from 'react';
import { useAppearance } from '@/hooks/ui/useAppearance';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { whiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import { pinFromMenu, unpinShape, type SlotSource } from '@/lib/whiteboard-shape-slots';
import {
  EraserFlyoutBody,
  PenFlyoutBody,
  penFlyoutLabel,
  SettingsFlyoutBody,
  ShapesFlyoutBody,
  SlotMenuBody,
} from './dock-flyouts';
import { DrawingToolsGroup } from './DrawingToolsGroup';
import { HistoryGroup } from './HistoryGroup';
import { ShapeSearch } from './ShapeSearch';
import { PINS_FULL_HINT, ShapesGroup } from './ShapesGroup';
import { SHAPES_GROUP_FLYOUTS, useDockFlyout, type DockFlyout } from './useDockFlyout';
import { WhiteboardFlyout } from './WhiteboardFlyout';

// How long the "two pinned" hint stays up.
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

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(t);
  }, [hint]);

  const pickAndClose = (pick: () => void) => {
    fly.close();
    pick();
  };

  // "Two shapes are pinned": above the Shapes group, where the refused slot settles back.
  const showPinsFull = (group: HTMLElement | null) => {
    const wrap = group?.closest('[data-whiteboard-dock]')?.getBoundingClientRect();
    const box = group?.getBoundingClientRect();
    setHint({ left: wrap && box ? box.left + box.width / 2 - wrap.left : 0 });
  };

  // Pin to dock / Unpin from a slot's menu: the same limit and refusal as a drag.
  const chooseFromSlotMenu = (slot: SlotSource) => {
    const outcome =
      slot.from === 'pinned'
        ? unpinShape(model.pinnedShapes, slot.key)
        : pinFromMenu(model.pinnedShapes, slot.key);
    fly.close(true);
    if (outcome.type !== 'refused') {
      model.applySlotOutcome(outcome);
      return;
    }
    showPinsFull(
      document.querySelector<HTMLElement>('[data-whiteboard-dock] [data-dock-group="shapes"]'),
    );
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
          body: <ShapesFlyoutBody onPick={(id) => pickAndClose(() => model.pickShape(id))} />,
        };
      case 'settings':
        return {
          label: 'Settings',
          hideTitle: true,
          body: <SettingsFlyoutBody model={model} ink={ink} appearance={appearance} />,
        };
      case 'search':
        return {
          label: 'More shapes',
          hideTitle: true,
          body: (
            <ShapeSearch
              ink={ink}
              onPick={(key) => pickAndClose(() => model.pickSearchedShape(key))}
            />
          ),
        };
      case 'slot': {
        const slot = f.slot;
        const entry = slot ? whiteboardShapeEntry(slot.key) : undefined;
        if (!slot || !entry) return null;
        return {
          label: entry.label,
          body: (
            <SlotMenuBody
              pinned={slot.from === 'pinned'}
              onChoose={() => chooseFromSlotMenu(slot)}
            />
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
      className="pointer-events-none absolute bottom-[4.25rem] left-1/2 z-[var(--z-toolbar)] w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 min-[1680px]:bottom-4"
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
          takeFocus={!fly.flyout.hover}
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
          Scrolling moves the openers, so an open flyout closes rather than float off its button. */}
      <div
        data-dock-scroller=""
        onScroll={() => (fly.flyout ? fly.close() : undefined)}
        className="-m-3 flex items-center gap-3 overflow-x-auto p-3 [scrollbar-width:none]"
      >
        <DrawingToolsGroup model={model} ink={ink} fly={fly} pickAndClose={pickAndClose} />
        <HistoryGroup canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
        {showShapes ? (
          <ShapesGroup
            model={model}
            fly={fly}
            pickAndClose={pickAndClose}
            onRefused={showPinsFull}
          />
        ) : null}
      </div>
    </div>
  );
}
