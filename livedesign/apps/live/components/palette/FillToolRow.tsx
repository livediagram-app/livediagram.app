'use client';

// The Fill tool's row in a logo page's Draw (docs/specs/023-draw-mode/drawing-tools.md "The Fill
// tool", docs/specs/007-editor/logo-pages.md "The Logo palette"): a paint bucket over the colour it
// pours. A press picks it up, held until another tool or Escape puts it down; pressed again while
// held, it opens its colour, the one colour picker, whose pick re-arms it at once.
import { useState } from 'react';
import { FillToolIcon } from '@livedesign/ui';
import { standardColours, type CanvasSurface } from '@livedesign/design';
import {
  FILL_TRANSPARENT,
  loadFillChoice,
  saveFillChoice,
} from '@liveworkspace/workbench/lib/fill-choice';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { noColour, standardGroup } from '@/components/colour/colour-options';
import { useThemeColours } from '@/components/colour/useThemeColours';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { WhiteboardFlyout } from '@/components/canvas/whiteboard/WhiteboardFlyout';
import { useDesignColours } from '@/hooks/ui/useDesignColours';
import { isFillIntent, type PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import type { PaletteTileDef } from './palette-tile-defs';
import type { PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRow } from './PaletteToolRows';

// Where this browser keeps the Fill tool's colour.
export const FILL_CHOICE_KEY = 'livedesign:v2:fill';
const ANCHOR = 'logo-fill';

/** Until one is picked the bucket pours the soft Blue, drawn for the canvas it pours on. */
export function defaultFill(surface: CanvasSurface): string {
  return standardColours('soft', surface).find((c) => c.name === 'blue')!.hex;
}

/** The Fill tool's tile, as its row shows it: its colour on the bucket. */
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
    action: { type: 'fill' },
    icon: <FillToolIcon colour={colour === FILL_TRANSPARENT ? null : colour} size={18} />,
  };
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
  const surface = useCanvasSurface();
  const theme = useThemeColours();
  const yours = useDesignColours();
  const [choice, setChoice] = useState(() => loadFillChoice(FILL_CHOICE_KEY));
  const [open, setOpen] = useState(false);
  const fill = choice ?? defaultFill(surface);
  const held = isFillIntent(pendingDraw);
  const pick = () => {
    beginDraw({ type: 'fill', fill });
    track('Draw', 'Selected', 'Fill');
  };
  const setFill = (next: string) => {
    if (next === fill) return;
    setChoice(next);
    saveFillChoice(FILL_CHOICE_KEY, next);
    if (held) beginDraw({ type: 'fill', fill: next });
    track('Draw', 'Changed', 'FillColour');
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
          <ColourPicker
            label="Fill colour"
            value={fill}
            leading={[noColour(FILL_TRANSPARENT, 'No fill')]}
            theme={theme}
            standard={[standardGroup('soft', surface, 'hex')]}
            yours={yours}
            onPick={setFill}
          />
        </WhiteboardFlyout>
      ) : null}
    </>
  );
}
