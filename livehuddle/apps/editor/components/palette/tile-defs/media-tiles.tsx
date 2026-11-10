import { lucideImage } from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livehuddle/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Media tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const MEDIA_TILES: PaletteTileDef[] = [
  {
    id: 'tools:image',
    blurb: 'Place an uploaded picture',
    section: 'media',
    label: 'Add Image',
    // Write's third tile (docs/specs/002-project-scope/not-in-livehuddle.md "Images are back"), only where uploads work
    // (`needsImage`). No `9` key.
    description: 'Place a frame, then upload a picture or pick one from your gallery.',
    noTint: true,
    needsImage: true,
    action: { type: 'image' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideImage} />
      </Glyph>
    ),
  },
  {
    id: 'tools:avatar',
    blurb: 'A circular photo of a person',
    section: 'media',
    label: 'Add Avatar',
    description:
      'Avatar. A circular image. Click to drop or drag to size; double-click it to pick / upload a photo.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'avatar' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9.5" r="3" />
        <path d="M6.5 19a6 6 0 0 1 11 0" />
      </Glyph>
    ),
  },
  {
    id: 'tools:link-card',
    blurb: 'A clickable preview of a link',
    // Offered by no category (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card"): kept
    // so a stored link card still finds its name and glyph. It left Travel with the Media category.
    section: 'media',
    label: 'Add Link Card',
    description: "Link card. A bookmark preview with the page's title, favicon, and image.",
    noTint: true,
    action: { type: 'link-card' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
      </Glyph>
    ),
  },
];
