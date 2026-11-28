// A Tree's species (docs/specs/009-elements/office.md "Tree species"): each species' flat drawing, in the Oak's style
// (a soft shadow, a trunk, a crown in its own colours), on the Oak's 120 by 160 grid with its trunk on the same
// footprint, so every species walks the same. The Oak is the tree as it always was (office-garden.ts TREE_VIEW).
// Pure: no React, no DOM.

import type { FurnitureArt, FurnitureDrawing } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';
import { OFFICE_EXTRA_ART } from './office-garden';
import { TREE_VARIANTS } from './piece-variants';

export type TreeSpecies = (typeof TREE_VARIANTS)[number];

/** Each species' own colours: what keeps its colour whatever the theme, as GARDEN_TONES. */
export const TREE_TONES = {
  pine: { deep: '#1f4d3a', mid: '#2b6449', light: '#3f7d5a', bark: '#5f3d22' },
  birch: {
    deep: '#6f9c3e',
    mid: '#8fbb4e',
    light: '#b5d873',
    bark: '#efece4',
    mark: '#3b3632',
  },
  palm: { deep: '#2f7a3a', mid: '#46a04a', light: '#6cc15c', bark: '#a8804f', nut: '#6b4a2b' },
  cherry: { deep: '#d27a9a', mid: '#eba3bb', light: '#f7cbd9', bark: '#5a3a2e' },
  maple: { deep: '#b4432b', mid: '#df7a30', light: '#f0b43e', bark: '#6b4428' },
  willow: { deep: '#557f37', mid: '#76a64c', light: '#9cc66b', bark: '#6e4b2c' },
} as const;

const SHADOW = ellipse('shadow', 60, 151, 46, 6);

// Stacked cone tiers of deep blue-green needles on a straight dark trunk, a pointed top.
const PINE_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 60, 151, 40, 6),
    path('panel', 'M55 152L56.5 112H63.5L65 152Z', TREE_TONES.pine.bark),
    path('panel', 'M12 124Q60 136 108 124L60 66Z', TREE_TONES.pine.deep),
    path('panel', 'M20 100Q60 111 100 100L60 42Z', TREE_TONES.pine.mid),
    path('panel', 'M30 74Q60 83 90 74L60 18Z', TREE_TONES.pine.mid),
    path('panel', 'M40 48Q60 54 80 48L60 2Z', TREE_TONES.pine.light),
    path('glint', 'M52 30L44 44M50 58L38 72'),
  ],
  seats: [],
};

// A slim white trunk with dark bark marks, a light airy crown of small clumps.
const BIRCH_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    SHADOW,
    path(
      'panel',
      'M55 152C57 128 57.5 100 56.5 64H63.5C62.5 100 63 128 65 152Z',
      TREE_TONES.birch.bark,
    ),
    rect('mark', 57, 136, 5, 1.6, 0.8, TREE_TONES.birch.mark),
    rect('mark', 58, 122, 4, 1.4, 0.7, TREE_TONES.birch.mark),
    rect('mark', 57.5, 108, 5, 1.6, 0.8, TREE_TONES.birch.mark),
    rect('mark', 58.5, 94, 3.5, 1.4, 0.7, TREE_TONES.birch.mark),
    rect('mark', 57.5, 80, 4.5, 1.4, 0.7, TREE_TONES.birch.mark),
    path('rail', 'M58 92L46 76M62 84L74 68'),
    ellipse('panel', 60, 54, 36, 44, TREE_TONES.birch.deep),
    ellipse('panel', 42, 66, 16, 14, TREE_TONES.birch.mid),
    ellipse('panel', 78, 62, 16, 14, TREE_TONES.birch.mid),
    ellipse('panel', 60, 36, 22, 20, TREE_TONES.birch.mid),
    ellipse('panel', 46, 42, 12, 11, TREE_TONES.birch.light),
    ellipse('panel', 74, 40, 11, 10, TREE_TONES.birch.light),
    ellipse('panel', 60, 18, 12, 10, TREE_TONES.birch.light),
  ],
  seats: [],
};

// A tall ringed trunk leaning a little, a crown of long drooping fronds, coconuts under them.
const PALM_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 62, 151, 42, 6),
    path('panel', 'M54 152C56 118 62 80 69 40H77C70 80 66 118 66 152Z', TREE_TONES.palm.bark),
    path('rail', 'M55.5 140H65.5M57 124H66M59 108H67.5M61.5 92H69.5M64.5 76H72M67 60H75'),
    path('panel', 'M73 40C58 26 32 26 10 52C34 40 54 38 73 46Z', TREE_TONES.palm.deep),
    path('panel', 'M73 40C88 26 112 28 116 56C98 40 86 38 73 46Z', TREE_TONES.palm.deep),
    path('panel', 'M73 42C60 44 42 58 34 82C48 62 62 52 74 48Z', TREE_TONES.palm.mid),
    path('panel', 'M73 42C86 44 100 58 104 82C94 62 84 52 72 48Z', TREE_TONES.palm.mid),
    path('panel', 'M72 40C62 24 50 12 30 10C48 20 60 30 70 44Z', TREE_TONES.palm.light),
    path('panel', 'M74 40C82 22 94 10 112 12C96 22 86 32 76 44Z', TREE_TONES.palm.light),
    ellipse('panel', 69, 48, 4, 4, TREE_TONES.palm.nut),
    ellipse('panel', 77, 49, 4, 4, TREE_TONES.palm.nut),
  ],
  seats: [],
};

// A dark spreading trunk and branches under a wide crown of pink blossom.
const CHERRY_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 60, 151, 50, 6),
    path('panel', 'M52 152C55 132 56 112 52 92H68C64 112 65 132 68 152Z', TREE_TONES.cherry.bark),
    path('panel', 'M54 98L30 76L34 72L58 92ZM66 98L90 74L86 70L62 92Z', TREE_TONES.cherry.bark),
    ellipse('panel', 60, 62, 57, 38, TREE_TONES.cherry.deep),
    ellipse('panel', 32, 64, 24, 20, TREE_TONES.cherry.mid),
    ellipse('panel', 88, 62, 24, 20, TREE_TONES.cherry.mid),
    ellipse('panel', 60, 42, 34, 24, TREE_TONES.cherry.mid),
    ellipse('panel', 42, 40, 14, 12, TREE_TONES.cherry.light),
    ellipse('panel', 78, 38, 14, 12, TREE_TONES.cherry.light),
    ellipse('mark', 22, 74, 2, 2, TREE_TONES.cherry.light),
    ellipse('mark', 98, 72, 2, 2, TREE_TONES.cherry.light),
    ellipse('mark', 40, 146, 2, 1.4, TREE_TONES.cherry.mid),
    ellipse('mark', 84, 148, 2, 1.4, TREE_TONES.cherry.mid),
    path('glint', 'M48 30C52 26 58 24 64 24'),
  ],
  seats: [],
};

// The Oak's round crown in autumn: orange, red and gold, a few leaves fallen round its foot.
const MAPLE_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    SHADOW,
    path('panel', 'M51 152C54 130 55 112 51 92H69C65 112 66 130 69 152Z', TREE_TONES.maple.bark),
    path('rail', 'M58 140V104M63 132V112'),
    ellipse('panel', 60, 64, 54, 46, TREE_TONES.maple.deep),
    ellipse('panel', 38, 62, 26, 24, TREE_TONES.maple.mid),
    ellipse('panel', 82, 60, 26, 24, TREE_TONES.maple.mid),
    ellipse('panel', 60, 40, 34, 28, TREE_TONES.maple.mid),
    ellipse('panel', 42, 36, 16, 14, TREE_TONES.maple.light),
    ellipse('panel', 78, 34, 16, 14, TREE_TONES.maple.light),
    ellipse('mark', 30, 150, 3, 1.6, TREE_TONES.maple.mid),
    ellipse('mark', 44, 155, 2.5, 1.4, TREE_TONES.maple.deep),
    ellipse('mark', 82, 153, 3, 1.6, TREE_TONES.maple.light),
    ellipse('mark', 94, 148, 2.5, 1.4, TREE_TONES.maple.mid),
    path('glint', 'M48 30C52 24 58 22 64 22'),
  ],
  seats: [],
};

// A stout trunk under a domed crown whose curtains of long leaves weep almost to the ground.
const WILLOW_VIEW: FurnitureDrawing = {
  width: 120,
  height: 160,
  parts: [
    ellipse('shadow', 60, 151, 50, 6),
    path('panel', 'M50 152C54 130 55 110 50 84H70C65 110 66 130 70 152Z', TREE_TONES.willow.bark),
    ellipse('panel', 60, 56, 50, 36, TREE_TONES.willow.deep),
    path('panel', 'M10 58C8 88 12 114 16 138H26C22 112 22 86 24 58Z', TREE_TONES.willow.deep),
    path('panel', 'M96 58C98 86 98 112 94 138H104C108 114 112 88 110 58Z', TREE_TONES.willow.deep),
    path('panel', 'M24 60C22 90 26 116 32 132H42C36 112 36 88 38 60Z', TREE_TONES.willow.mid),
    path('panel', 'M82 60C84 88 84 112 78 132H88C94 116 98 90 96 60Z', TREE_TONES.willow.mid),
    ellipse('panel', 60, 46, 40, 26, TREE_TONES.willow.mid),
    path('panel', 'M36 56C36 76 38 96 44 112H50C46 94 46 74 48 56Z', TREE_TONES.willow.light),
    path('panel', 'M72 56C74 74 74 94 70 112H76C82 96 84 76 84 56Z', TREE_TONES.willow.light),
    ellipse('panel', 60, 34, 24, 14, TREE_TONES.willow.light),
    path('glint', 'M46 28C50 24 56 22 62 22'),
  ],
  seats: [],
};

/** Each species' drawings (it reads the same from every side). The Oak is the Tree's own. */
export const TREE_SPECIES_ART: Readonly<Record<TreeSpecies, FurnitureArt>> = {
  oak: OFFICE_EXTRA_ART.tree,
  pine: allSides(PINE_VIEW),
  birch: allSides(BIRCH_VIEW),
  palm: allSides(PALM_VIEW),
  cherry: allSides(CHERRY_VIEW),
  maple: allSides(MAPLE_VIEW),
  willow: allSides(WILLOW_VIEW),
};

/** A tree's species: its stored `variant` when a tree takes it, else the Oak. */
export function treeSpecies(variant: unknown): TreeSpecies {
  return typeof variant === 'string' && (TREE_VARIANTS as readonly string[]).includes(variant)
    ? (variant as TreeSpecies)
    : 'oak';
}

/** The drawings a tree of `variant` draws. */
export function treeArt(variant: unknown): FurnitureArt {
  return TREE_SPECIES_ART[treeSpecies(variant)];
}
