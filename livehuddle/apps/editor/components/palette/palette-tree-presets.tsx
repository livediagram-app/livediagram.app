import { Glyph } from '@livehuddle/ui';
import { TreeIcon } from './palette-icons-garden';
import { TILE_GLYPH_PX, type PaletteTileDef } from './tile-defs/types';

// The Tree tile's species (docs/specs/009-elements/office.md "Tree species"), as the Rug tile opens its rugs
// (palette-floor-presets.tsx): each an ordinary tile carrying its species as its variant, which places, drags and
// previews as its tile does. Not in PALETTE_TILES: they live under the Tree tile, so the Garden's tile count and
// Search keep the one Tree.

const tree = (
  variant: string | undefined,
  caption: string,
  blurb: string,
  description: string,
  icon: React.ReactNode,
): PaletteTileDef => ({
  id: `tools:tree${variant ? `-${variant}` : ''}`,
  section: 'tools',
  toolGroup: 'behaviour',
  tileGroup: 'garden',
  caption,
  label: `Add ${caption}${caption.endsWith('Tree') ? '' : ' Tree'}`,
  blurb,
  description,
  filled: true,
  action: { type: 'shape', kind: 'tree', ...(variant ? { variant } : {}) },
  icon,
});

const glyph = (body: React.ReactNode) => (
  <Glyph size={TILE_GLYPH_PX} units={24}>
    {body}
  </Glyph>
);

export const TREE_PRESET_TILES: readonly PaletteTileDef[] = [
  tree(
    undefined,
    'Oak',
    'A big round leafy crown',
    'An oak: a flared trunk and a big round crown of leaves. Characters walk round its trunk and pass in front of its leaves.',
    <TreeIcon size={TILE_GLYPH_PX} />,
  ),
  tree(
    'pine',
    'Pine',
    'Tiers of evergreen needles',
    'A pine: a straight trunk under stacked tiers of dark evergreen needles, rising to a point.',
    glyph(
      <>
        <path d="M12 2 7 9h3l-4 6h3.5L5 20h14l-4.5-5H18l-4-6h3z" />
        <path d="M12 20v2.5" />
      </>,
    ),
  ),
  tree(
    'birch',
    'Birch',
    'A white trunk, airy leaves',
    'A birch: a slim white trunk with dark marks under a light, airy crown of small leaves.',
    glyph(
      <>
        <circle cx="12" cy="5" r="3" />
        <circle cx="8" cy="10" r="3" />
        <circle cx="16" cy="10" r="3" />
        <path d="M11 13.5v9M13 13.5v9M11 16.5h1.3M12 19.5h1" />
      </>,
    ),
  ),
  tree(
    'palm',
    'Palm',
    'Fronds on a tall trunk',
    'A palm: a tall ringed trunk leaning a little, a crown of long drooping fronds and coconuts under them.',
    glyph(
      <>
        <path d="M10 22.5c.5-5 1.5-10 3-15" />
        <path d="M13 7.5C10 5 6 5 3 8.5M13 7.5c3-2.5 7-2.5 9 1M13 7.5c-2 1-4 3.5-5 7M13 7.5c2 1 4 3.5 4.5 7M13 7.5c-1-2.5-3-4.5-6-5M13 7.5c1-2.5 3-4.5 6-5" />
      </>,
    ),
  ),
  tree(
    'cherry',
    'Cherry Blossom',
    'A wide crown of pink blossom',
    'A cherry tree in blossom: a dark spreading trunk under a wide crown of pink flowers.',
    glyph(
      <>
        <path d="M2.5 10.5C2.5 5.5 7 3 12 3s9.5 2.5 9.5 7.5S17 15 12 15 2.5 15.5 2.5 10.5z" />
        <path d="M12 15v7.5M12 17.5 8.5 14M12 17l3.5-3.5" />
        <circle cx="8" cy="8" r="0.9" />
        <circle cx="15" cy="7" r="0.9" />
        <circle cx="12" cy="11" r="0.9" />
      </>,
    ),
  ),
  tree(
    'maple',
    'Autumn Maple',
    'Orange, red and gold leaves',
    'A maple in autumn: a round crown in orange, red and gold, a few leaves fallen round its foot.',
    glyph(
      <>
        <path d="M12 2.5 13.5 6l3-1-1 3.5 3.5 1-3 2.5 1.5 3-3.5-.5L12 17l-2-2.5-3.5.5 1.5-3-3-2.5 3.5-1-1-3.5 3 1z" />
        <path d="M12 17v5.5M5 22.5h1.5M17.5 22h1.5" />
      </>,
    ),
  ),
  tree(
    'willow',
    'Willow',
    'Long leaves weeping down',
    'A weeping willow: a stout trunk under a domed crown whose long leaves hang in curtains almost to the ground.',
    glyph(
      <>
        <path d="M3 11a9 7.5 0 0 1 18 0" />
        <path d="M4 11c-.5 3.5 0 6.5 1 9M8 10c-.5 4 0 7 1 9.5M16 10c.5 4 0 7-1 9.5M20 11c.5 3.5 0 6.5-1 9" />
        <path d="M11 13h2v9.5h-2z" />
      </>,
    ),
  ),
];
