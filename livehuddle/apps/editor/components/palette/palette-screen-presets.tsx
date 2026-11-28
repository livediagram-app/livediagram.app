import { Glyph } from '@livehuddle/ui';
import { ScreenIcon } from './palette-icons-meeting';
import { TILE_GLYPH_PX, type PaletteTileDef } from './tile-defs/types';

// The Screen tile's sizes (docs/specs/009-elements/screen-and-room-sign.md "Sizes"), as the Tree tile opens its species
// (palette-tree-presets.tsx): each an ordinary tile carrying its size as its variant, which places, drags and previews
// as its tile does. Not in PALETTE_TILES: they live under the Screen tile, so Meet's tile count and Search keep the
// one Screen. Smallest first; the Medium is the Screen's own default.

const screen = (
  variant: string | undefined,
  caption: string,
  blurb: string,
  description: string,
  icon: React.ReactNode,
): PaletteTileDef => ({
  id: `tools:screen${variant ? `-${variant}` : ''}`,
  section: 'tools',
  toolGroup: 'behaviour',
  tileGroup: 'meeting',
  caption,
  label: `Add ${caption} Screen`,
  blurb,
  description,
  filled: true,
  action: { type: 'shape', kind: 'screen', ...(variant ? { variant } : {}) },
  icon,
});

// A panel of `w` by `h` (in the glyph's 24 units) standing on the glyph's floor, as a size reads against the others.
const panel = (w: number, h: number, stand: 'foot' | 'legs' | 'none') => {
  const x = 12 - w / 2;
  const floor = 21;
  const y = stand === 'none' ? (24 - h) / 2 : floor - 3 - h;
  return (
    <Glyph size={TILE_GLYPH_PX} units={24}>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(1.5, h / 6)} />
      {stand === 'foot' ? <path d={`M12 ${y + h}V${floor}M9.5 ${floor}h5`} /> : null}
      {stand === 'legs' ? (
        <path
          d={`M${x + w * 0.22} ${y + h}l-1.5 ${floor - y - h}M${x + w * 0.78} ${y + h}l1.5 ${floor - y - h}`}
        />
      ) : null}
    </Glyph>
  );
};

export const SCREEN_PRESET_TILES: readonly PaletteTileDef[] = [
  screen(
    'monitor',
    'Monitor',
    'A small screen by a desk',
    'A monitor-sized wall screen, 96 by 60: enough for a share in a pod or a phone booth.',
    panel(10, 6.5, 'foot'),
  ),
  screen(
    'small',
    'Small',
    'For a small meeting room',
    'A small wall screen, 144 by 90, for a huddle room or a corner.',
    panel(14, 9, 'foot'),
  ),
  screen(
    undefined,
    'Medium',
    "Shows the room's screen share",
    "A meeting room's wall screen, 192 by 120. When someone in its room shares their screen it shows for everyone in the room; otherwise it plays a video link set from its menu.",
    <ScreenIcon size={TILE_GLYPH_PX} />,
  ),
  screen(
    'large',
    'Large',
    'For a big room or a town hall',
    'A large screen, 320 by 200, on a wide stand against its wall, for a big meeting room or a team area.',
    panel(18, 11.5, 'legs'),
  ),
  screen(
    'cinema',
    'Cinema',
    'A video wall for an audience',
    'A cinema-sized screen, 640 by 400, on a wide stand: a video wall for an auditorium, a stage or a garden screening.',
    panel(22, 13, 'legs'),
  ),
];
