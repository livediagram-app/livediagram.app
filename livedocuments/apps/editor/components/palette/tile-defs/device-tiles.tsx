import { Glyph } from '@livedocuments/ui';
import type { PaletteTileDef } from './types';

// The Devices tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const DEVICE_TILES: PaletteTileDef[] = [
  // --- Devices (docs/specs/008-canvas/canvas-and-palette.md) ------------------------------------------------------
  {
    id: 'devices:browser',
    blurb: 'A desktop web page frame',
    section: 'devices',
    label: 'Add Web Browser',
    caption: 'Browser',
    description: 'Browser window. Frame a web page or a web-app screen.',
    filled: true,
    action: { type: 'shape', kind: 'browser' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="2" y="3" width="14" height="12" rx="1.5" />
        <path d="M2 7 L16 7" />
      </Glyph>
    ),
  },
  {
    id: 'devices:monitor',
    blurb: 'A full-screen desktop layout',
    section: 'devices',
    label: 'Add Computer Monitor',
    caption: 'Monitor',
    description: 'Desktop monitor with stand. Frame a desktop app.',
    filled: true,
    action: { type: 'shape', kind: 'monitor' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="2" y="2.5" width="14" height="9" rx="1" />
        <path d="M6 15.5 L12 15.5" />
        <path d="M9 11.5 L9 15.5" />
      </Glyph>
    ),
  },
  {
    id: 'devices:laptop',
    blurb: 'A portable-screen view',
    section: 'devices',
    label: 'Add Laptop',
    description: 'Laptop. Screen plus keyboard base.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'laptop' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="3.5" y="3" width="11" height="8" rx="1" />
        <path d="M1.5 14 L16.5 14 L15 11 L3 11 Z" />
      </Glyph>
    ),
  },
  {
    id: 'devices:phone',
    blurb: 'A mobile app or page',
    section: 'devices',
    label: 'Add Phone',
    description: 'Phone. Frame a mobile screen.',
    filled: true,
    action: { type: 'shape', kind: 'phone' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="5.5" y="1.5" width="7" height="15" rx="1.6" />
      </Glyph>
    ),
  },
  {
    id: 'devices:tablet',
    blurb: 'A larger touch layout',
    section: 'devices',
    label: 'Add Tablet',
    description: 'Tablet. Larger than a phone, smaller than a laptop screen.',
    filled: true,
    action: { type: 'shape', kind: 'tablet' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="3" y="2" width="12" height="14" rx="1.2" />
      </Glyph>
    ),
  },
  {
    id: 'devices:foldable',
    blurb: 'A foldable phone, opened out',
    section: 'devices',
    label: 'Add Foldable',
    caption: 'Foldable',
    description: 'Foldable phone, unfolded. A book-style phone opened to its inner screen.',
    filled: true,
    action: { type: 'shape', kind: 'foldable' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="1.5" y="3" width="15" height="12" rx="1.2" />
        <path d="M9 3 V15" />
      </Glyph>
    ),
  },
  {
    id: 'devices:smartwatch',
    blurb: 'A compact wearable screen',
    section: 'devices',
    label: 'Add Smartwatch',
    caption: 'Watch',
    description: 'Smartwatch. A wrist-device frame for watch-app screens.',
    filled: true,
    action: { type: 'shape', kind: 'smartwatch' },
    icon: (
      <Glyph size={18} units={18} strokeLinecap="butt">
        <rect x="5.5" y="4" width="7" height="10" rx="2.2" />
        <path d="M7 4 V1.8 M11 4 V1.8 M7 14 V16.2 M11 14 V16.2 M12.5 8 H14" />
      </Glyph>
    ),
  },
];
