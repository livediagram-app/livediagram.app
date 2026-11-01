'use client';

// The Fill tool in a logo page's Draw (docs/specs/023-draw-mode/drawing-tools.md "The Fill tool",
// docs/specs/007-editor/logo-pages.md "The Logo palette"): a paint bucket over the colour it pours.
// As a row (the palette's Draw tab) a press picks it up, held until another tool or Escape puts it
// down; pressed again while held, it opens its colour, the one colour picker, whose pick re-arms it
// at once. As a tile (the category flyout) a press picks it up and its side panel holds the picker.
import { useContext, useState } from 'react';
import { FillToolIcon } from '@livedesign/ui';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import { FILL_TRANSPARENT } from '@liveworkspace/workbench/lib/fill-choice';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { noColour, standardGroup } from '@/components/colour/colour-options';
import { useThemeColours } from '@/components/colour/useThemeColours';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { WhiteboardFlyout } from '@/components/canvas/whiteboard/WhiteboardFlyout';
import { useDesignColours } from '@/hooks/ui/useDesignColours';
import { isFillIntent, type PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { setFillColour, useFillColour } from './fill-tool-colour';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRow } from './PaletteToolRows';

const ANCHOR = 'logo-fill';

/** The Fill tool's tile, as its row and the category flyout show it: its colour on the bucket. */
export function fillToolTile(colour: string): PaletteTileDef {
  return {
    id: 'logo:fill',
    section: 'logo',
    label: 'Fill',
    caption: 'Fill',
    blurb: 'Click inside a closed shape to fill it',
    description:
      'A paint bucket: click inside a closed shape, or a marker loop whose ends meet, to fill it. It stays in your hand until you pick another tool or press Escape.',
    noTint: true,
    action: { type: 'fill', fill: colour },
    icon: <FillToolIcon colour={colour === FILL_TRANSPARENT ? null : colour} size={18} />,
  };
}

/** The Fill tool for the category flyout: its tile in this browser's colour, and its pick-up (none
 *  outside an editor, where the palette offers no Fill). */
export function useLogoFillTool(): {
  tile: PaletteTileDef | null;
  begin: ((fill: string) => void) | undefined;
} {
  const editor = useContext(EditorContext);
  const fill = useFillColour();
  if (!editor) return { tile: null, begin: undefined };
  return {
    tile: fillToolTile(fill),
    begin: (next) => {
      editor.beginDraw({ type: 'fill', fill: next });
      track('Draw', 'Selected', 'Fill');
    },
  };
}

/** The bucket's colour, the one colour picker: a pick is kept for this browser, reported, and
 *  handed to `onPick` (which picks the bucket up in it), even when it is the colour already kept. */
export function FillColourPicker({ onPick }: { onPick: (fill: string) => void }) {
  const surface = useCanvasSurface();
  const theme = useThemeColours();
  const yours = useDesignColours();
  const fill = useFillColour();
  return (
    <ColourPicker
      label="Fill colour"
      value={fill}
      leading={[noColour(FILL_TRANSPARENT, 'No fill')]}
      theme={theme}
      standard={[standardGroup('soft', surface, 'hex')]}
      yours={yours}
      onPick={(next) => {
        if (next !== fill) {
          setFillColour(next);
          track('Draw', 'Changed', 'FillColour');
        }
        onPick(next);
      }}
    />
  );
}

export function FillToolRow({
  actions,
  pendingDraw,
  beginDraw,
  scope,
}: {
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  beginDraw: (intent: PendingDraw) => void;
  // The palette body the flyout is placed against.
  scope: string;
}) {
  const fill = useFillColour();
  const [open, setOpen] = useState(false);
  const held = isFillIntent(pendingDraw);
  const pick = () => {
    beginDraw({ type: 'fill', fill });
    track('Draw', 'Selected', 'Fill');
  };
  return (
    <>
      <PaletteToolRow
        def={fillToolTile(fill)}
        actions={actions}
        pendingDraw={pendingDraw}
        anchor={ANCHOR}
        expanded={held ? open : undefined}
        onPress={() => (held ? setOpen((v) => !v) : pick())}
      />
      {open && held ? (
        <WhiteboardFlyout
          id={`${ANCHOR}-flyout`}
          label="Fill"
          anchor={ANCHOR}
          scope={scope}
          onClose={() => setOpen(false)}
        >
          <FillColourPicker
            onPick={(next) => {
              // Held already: a new colour re-arms it; the same one changes nothing.
              if (pendingDraw?.type === 'fill' && pendingDraw.fill !== next)
                beginDraw({ type: 'fill', fill: next });
            }}
          />
        </WhiteboardFlyout>
      ) : null}
    </>
  );
}
