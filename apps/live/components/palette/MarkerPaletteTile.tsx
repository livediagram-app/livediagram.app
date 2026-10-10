'use client';

// A marker's palette tile (Draw mode's pen, offered in the Logo category and the Toolbar strip's
// Search: docs/specs/007-editor/logo-pages.md "The Logo palette"). Pressed, it picks the marker up;
// pressed again while held, it opens Draw mode's own flyout for it (colour and width), as the
// whiteboard dock's marker does. A change re-arms the held marker, so the next stroke is in it.
import { useContext, useState } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { PenFlyoutBody, penFlyoutLabel } from '@/components/canvas/whiteboard/dock-flyouts';
import { WhiteboardFlyout } from '@/components/canvas/whiteboard/WhiteboardFlyout';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import type { PendingDraw } from '@/lib/draw-mode';
import type { PaletteTileDef } from './palette-tile-defs';
import { PaletteTile, tileActive, tileHandler, type PaletteTileActions } from './PaletteTileGrid';

export function MarkerPaletteTile({
  def,
  actions,
  pendingDraw,
  compact,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  compact?: boolean;
}) {
  const editor = useContext(EditorContext);
  const [open, setOpen] = useState(false);
  const a = def.action;
  const model = editor?.whiteboardDock;
  const pen = a.type === 'marker' ? model?.prefs.pens.find((p) => p.id === a.penId) : undefined;
  const held = tileActive(def, pendingDraw);
  const key = `marker-tile-${def.id}`;
  const pick = tileHandler(def, actions);
  // The flyout's changes, then the marker picked up again in them (beginMarker reads them back).
  const live: WhiteboardDockModel | undefined =
    model && a.type === 'marker'
      ? {
          ...model,
          updatePen: (id, patch) => {
            model.updatePen(id, patch);
            if (id === a.penId) pick?.();
          },
        }
      : undefined;
  return (
    <span data-marker-tile={key} className="relative inline-flex">
      <span data-dock-item={key} className="inline-flex">
        <PaletteTile
          def={def}
          actions={actions}
          pendingDraw={pendingDraw}
          compact={compact}
          onPress={() => (held && live ? setOpen((v) => !v) : pick?.())}
        />
      </span>
      {open && held && pen && live ? (
        <WhiteboardFlyout
          id={`${key}-flyout`}
          label={penFlyoutLabel(pen)}
          anchor={key}
          placement="below"
          scope={`[data-marker-tile="${key}"]`}
          onClose={() => setOpen(false)}
        >
          <PenFlyoutBody pen={pen} model={live} />
        </WhiteboardFlyout>
      ) : null}
    </span>
  );
}
