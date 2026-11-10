import { lucideCircle, lucideDiamond, lucideSquare } from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livediagram/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Shapes tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const SHAPE_TILES: PaletteTileDef[] = [
  // --- Shapes -------------------------------------------------------------
  {
    id: 'shapes:square',
    section: 'shapes',
    label: 'Add Square',
    description: 'Drop a new square shape on the canvas.',
    shortcut: 'R',
    filled: true,
    action: { type: 'shape', kind: 'square' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideSquare} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:circle',
    section: 'shapes',
    label: 'Add Circle',
    description: 'Drop a new circle shape on the canvas.',
    shortcut: 'O',
    filled: true,
    action: { type: 'shape', kind: 'circle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideCircle} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:diamond',
    section: 'shapes',
    label: 'Add Diamond',
    description: 'Diamond. Decision node.',
    shortcut: 'D',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'diamond' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideDiamond} />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cylinder',
    section: 'shapes',
    label: 'Add Cylinder',
    description: 'Cylinder. Flowchart database / storage.',
    shortcut: 'C',
    filled: true,
    action: { type: 'shape', kind: 'cylinder' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5" />
        <ellipse cx="9" cy="5" rx="6" ry="1.8" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:parallelogram',
    section: 'shapes',
    label: 'Add Parallelogram',
    description: 'Parallelogram. Flowchart input / output.',
    shortcut: 'G',
    filled: true,
    action: { type: 'shape', kind: 'parallelogram' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 16,3 13,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:hexagon',
    section: 'shapes',
    label: 'Add Hexagon',
    description: 'Hexagon. Preparation / milestone.',
    filled: true,
    action: { type: 'shape', kind: 'hexagon' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,3 13,3 16,9 13,15 5,15 2,9" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:document',
    section: 'shapes',
    label: 'Add Document',
    description: 'Document shape. Flowchart output.',
    filled: true,
    action: { type: 'shape', kind: 'document' },
    icon: (
      <Glyph size={18} units={18}>
        <path d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:stadium',
    section: 'shapes',
    label: 'Add Stadium',
    description: 'Stadium shape. Flowchart Start / End.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'stadium' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="1.5" y="6" width="15" height="6" rx="3" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:cloud',
    section: 'shapes',
    label: 'Add Cloud',
    description: 'Cloud. Networking / architecture.',
    filled: true,
    action: { type: 'shape', kind: 'cloud' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:triangle',
    section: 'shapes',
    label: 'Add Triangle',
    description: 'Triangle. A basic shape.',
    filled: true,
    action: { type: 'shape', kind: 'triangle' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,3 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:trapezoid',
    section: 'shapes',
    label: 'Add Trapezoid',
    description: 'Trapezoid. Flowchart manual operation.',
    filled: true,
    action: { type: 'shape', kind: 'trapezoid' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="5,4 13,4 16,15 2,15" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:star',
    section: 'shapes',
    label: 'Add Star',
    description: 'Star. Highlight or rating.',
    filled: true,
    action: { type: 'shape', kind: 'star' },
    icon: (
      <Glyph size={18} units={18}>
        <polygon points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6" />
      </Glyph>
    ),
  },
  {
    id: 'shapes:speech-bubble',
    section: 'shapes',
    label: 'Add Speech Bubble',
    caption: 'Bubble',
    description: 'Speech bubble. A callout with a tail.',
    filled: true,
    action: { type: 'shape', kind: 'speech-bubble' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
      </Glyph>
    ),
  },
];
