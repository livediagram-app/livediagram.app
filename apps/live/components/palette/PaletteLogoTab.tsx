'use client';

// The Logo category (docs/specs/007-editor/logo-pages.md "The Logo palette"), offered in Illustrate
// mode while the tab has a logo page: the Pen and the Pencil, then Draw mode's three markers in this
// person's colours and widths. A marker is picked up for one stroke; pressed again while held, it
// opens Draw mode's own flyout for it (colour and width), whose changes re-arm it at once.
import { useContext, useState } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PenFlyoutBody, penFlyoutLabel } from '@/components/canvas/whiteboard/dock-flyouts';
import { WhiteboardFlyout } from '@/components/canvas/whiteboard/WhiteboardFlyout';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import type { PendingDraw } from '@/lib/draw-mode';
import { loadWhiteboardPrefs, type WhiteboardPen } from '@/lib/whiteboard-prefs';
import { whiteboardPenIntent } from '@/lib/whiteboard-tool';
import { markerTiles } from './palette-marker-tiles';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRow, PaletteToolRows } from './PaletteToolRows';

// The tab's own box: the markers' flyout is placed against it.
const SCOPE = '[data-palette-logo]';

/** Whether the armed tool is this marker (Draw mode's pen, picked up with its colour and width). */
function markerArmed(pending: PendingDraw | null | undefined, pen: WhiteboardPen): boolean {
  return (
    pending?.type === 'freehand' &&
    pending.variant === 'whiteboard' &&
    // The pen it is, when the intent says; else the look it draws in.
    (pending.penId !== undefined
      ? pending.penId === pen.id
      : pending.colour === pen.colour && pending.width === pen.width)
  );
}

function MarkerRow({
  def,
  pen,
  model,
  actions,
  pendingDraw,
  beginDraw,
}: {
  def: PaletteTileDef;
  pen: WhiteboardPen;
  model: WhiteboardDockModel;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  beginDraw: (intent: PendingDraw) => void;
}) {
  const [open, setOpen] = useState(false);
  const held = markerArmed(pendingDraw, pen);
  const key = `logo-marker-${pen.id}`;
  // From the model's own pen (what the row shows and the flyout edits), for one stroke.
  const arm = (p: WhiteboardPen) =>
    beginDraw({ ...whiteboardPenIntent(p, model.prefs.recognise), once: true });
  const live: WhiteboardDockModel = {
    ...model,
    updatePen: (id, patch) => {
      model.updatePen(id, patch);
      if (id === pen.id) arm({ ...pen, ...patch });
    },
  };
  return (
    <>
      <PaletteToolRow
        def={def}
        actions={actions}
        pendingDraw={pendingDraw}
        anchor={key}
        expanded={held ? open : undefined}
        onPress={() => (held ? setOpen((v) => !v) : arm(pen))}
      />
      {open && held ? (
        <WhiteboardFlyout
          id={`${key}-flyout`}
          label={penFlyoutLabel(pen)}
          anchor={key}
          placement="below"
          scope={SCOPE}
          onClose={() => setOpen(false)}
        >
          <PenFlyoutBody pen={pen} model={live} />
        </WhiteboardFlyout>
      ) : null}
    </>
  );
}

/** The Logo category's marker tiles: Draw mode's markers, for one stroke each, in the live colours
 *  and widths (the dock model's; outside an editor, as this browser last set them). None while the
 *  category is not offered. */
export function useLogoMarkerTiles(on: boolean): PaletteTileDef[] {
  const editor = useContext(EditorContext);
  const surface = useCanvasSurface();
  if (!on) return [];
  const prefs = editor?.whiteboardDock.prefs ?? loadWhiteboardPrefs();
  return markerTiles(prefs, surface).map((def): PaletteTileDef =>
    def.action.type === 'marker'
      ? { ...def, action: { ...def.action, once: true }, blurb: 'Your Draw mode marker' }
      : def,
  );
}

export function PaletteLogoTab({
  tiles,
  actions,
  pendingDraw,
}: {
  tiles: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  const editor = useContext(EditorContext);
  const model = editor?.whiteboardDock;
  const tools = tiles.filter((t) => t.action.type !== 'marker');
  const markers = tiles.filter((t) => t.action.type === 'marker');
  return (
    <div data-palette-logo="" className="flex flex-col gap-2">
      <PaletteToolRows tiles={tools} actions={actions} pendingDraw={pendingDraw} />
      {markers.length > 0 ? (
        <>
          <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Markers
          </p>
          <div className="flex flex-col gap-0.5">
            {markers.map((def) => {
              const a = def.action;
              const pen =
                a.type === 'marker' ? model?.prefs.pens.find((p) => p.id === a.penId) : undefined;
              return pen && model && editor ? (
                <MarkerRow
                  key={def.id}
                  def={def}
                  pen={pen}
                  model={model}
                  actions={actions}
                  pendingDraw={pendingDraw}
                  beginDraw={editor.beginDraw}
                />
              ) : (
                <PaletteToolRow
                  key={def.id}
                  def={def}
                  actions={actions}
                  pendingDraw={pendingDraw}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
