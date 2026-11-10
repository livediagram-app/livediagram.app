import { BADGE_PRESET_TILES, CARD_PRESET_TILES } from '../palette-element-presets';
import { BadgePresetGlyph } from '../BadgePresetGlyph';
import { badgePresetFace } from '@livedocuments/document';
import { lucideFileText, lucideGlobe, lucideImage } from '@liveworkspace/icons/lucide';
import { Glyph, Prims } from '@livedocuments/ui';
import {
  FigmaTileArt,
  LoomTileArt,
  VimeoTileArt,
  YouTubeTileArt,
} from '@liveworkspace/workbench/components/palette/embed-tile-art';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The media, card and layout element tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const ELEMENT_TILES: PaletteTileDef[] = [
  {
    id: 'tools:checklist',
    blurb: 'Tickable to-do rows',
    section: 'components',
    label: 'Add Checklist',
    caption: 'Checklist',
    description: 'Checkable to-do rows. Tick boxes on the canvas; edit rows from the menu.',
    filled: true,
    action: { type: 'shape', kind: 'checklist' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="2.5" y="3" width="4" height="4" rx="1" />
        <path d="M3.7 5 L4.6 5.9 L6 4.3" strokeWidth="1.2" />
        <path d="M9 5 H15.5" />
        <rect x="2.5" y="10.5" width="4" height="4" rx="1" />
        <path d="M9 12.5 H15.5" />
      </Glyph>
    ),
  },
  {
    id: 'tools:image',
    blurb: 'Place an uploaded picture',
    section: 'media',
    label: 'Add Image',
    description: 'Drop an image placeholder + pick / upload a file.',
    shortcut: '9',
    noTint: true,
    needsImage: true,
    dividerAfter: true,
    action: { type: 'image' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideImage} />
      </Glyph>
    ),
  },
  {
    id: 'media:embed-youtube',
    tileGroup: 'embed',
    blurb: 'A YouTube video',
    caption: 'YouTube',
    section: 'media',
    label: 'Add YouTube Embed',
    description:
      'Embeds a YouTube link on the canvas. Double-click it to set the link; it loads when you press play.',
    action: { type: 'video', provider: 'youtube' },
    icon: <YouTubeTileArt />,
  },
  {
    id: 'media:embed-vimeo',
    tileGroup: 'embed',
    blurb: 'A Vimeo video',
    caption: 'Vimeo',
    section: 'media',
    label: 'Add Vimeo Embed',
    description:
      'Embeds a Vimeo link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'vimeo' },
    icon: <VimeoTileArt />,
  },
  {
    id: 'media:embed-loom',
    tileGroup: 'embed',
    blurb: 'A Loom recording',
    caption: 'Loom',
    section: 'media',
    label: 'Add Loom Embed',
    description:
      'Embeds a Loom link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'loom' },
    icon: <LoomTileArt />,
  },
  {
    id: 'media:embed-figma',
    tileGroup: 'embed',
    blurb: 'A Figma file or prototype',
    caption: 'Figma',
    section: 'media',
    label: 'Add Figma Embed',
    description:
      'Embeds a Figma link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'figma' },
    icon: <FigmaTileArt />,
  },
  {
    id: 'media:embed-gdocs',
    tileGroup: 'embed',
    blurb: 'A Doc, Sheet or Slide deck',
    caption: 'Google Docs',
    section: 'media',
    label: 'Add Google Docs Embed',
    description:
      'Embeds a Google Docs link on the canvas. Double-click it to set the link; it loads when you press Load embed.',
    action: { type: 'video', provider: 'gdocs' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideFileText} />
      </Glyph>
    ),
  },
  {
    id: 'media:embed-website',
    tileGroup: 'embed',
    blurb: 'Any site, framed on the canvas',
    caption: 'Website',
    section: 'media',
    label: 'Add Website Embed',
    description:
      'Embeds any website on the canvas. Double-click it to set the address; it loads when you press Load embed. Some sites refuse to be framed and will come up blank.',
    dividerAfter: true,
    action: { type: 'video', provider: 'website' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideGlobe} />
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
    // The logo strip (docs/specs/009-elements/logo-strip.md): a row stack of grey logo pictures.
    id: 'media:logo-strip',
    blurb: 'A row of customer or partner logos',
    caption: 'Logo Strip',
    section: 'media',
    label: 'Add Logo Strip',
    description:
      'Logo strip. A row of customer or partner logos, evenly spaced and in grey, for a "Trusted by" slide. Click to drop or drag to size; pick a picture for each logo.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'logo-strip' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
        <rect x="8.5" y="10" width="7" height="4" rx="1.2" />
        <rect x="17.5" y="9.5" width="5" height="5" rx="2.5" />
        <path d="M2 18.5h20" strokeOpacity={0.35} />
      </Glyph>
    ),
  },
  {
    // The card (docs/specs/009-elements/card.md): a diagram node with slots, placed like any shape so the theme
    // paints it. The Callout below is its preset.
    id: 'components:card',
    blurb: 'A node with an icon, title, meta and tags',
    caption: 'Card',
    section: 'components',
    label: 'Add Card',
    description:
      'Card. A box with slots you switch on: a header band, an icon, a title and meta line, a body and tags. Click to drop or drag to size.',
    filled: true,
    action: { type: 'shape', kind: 'card' },
    variants: CARD_PRESET_TILES,
    variantsHint: 'Start from a preset, then switch any part on or off.',
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
        <rect x="5.5" y="6.5" width="4.5" height="4.5" rx="1.2" />
        <path d="M12.5 7.5h6M12.5 10h4M5.5 14h13" />
        <rect x="5.5" y="16.5" width="4" height="1.6" rx="0.8" />
        <rect x="11" y="16.5" width="4" height="1.6" rx="0.8" />
      </Glyph>
    ),
  },
  {
    // The badge (docs/specs/009-elements/badge.md): a pill that attaches to a point on a node when dropped there.
    id: 'components:badge',
    blurb: 'A small tag that sits on a node',
    caption: 'Badge',
    section: 'components',
    label: 'Add Badge',
    description:
      'Badge. A small pill like "Beta" or "v2". Drop it on a corner or edge of a node and it stays there as the node moves.',
    // Drawn as the badge it drops (a New pill), so untinted: the glyph carries the theme's colours itself.
    noTint: true,
    action: { type: 'shape', kind: 'badge' },
    variants: BADGE_PRESET_TILES,
    variantsHint: 'Start from a preset, then change its text, look or colour.',
    icon: <BadgePresetGlyph {...badgePresetFace(undefined)} />,
  },
  {
    // The step number (docs/specs/009-elements/step-number.md): numbers itself as it lands.
    id: 'components:step',
    blurb: 'A numbered disc for walkthroughs',
    caption: 'Step Number',
    section: 'components',
    label: 'Add Step Number',
    description:
      'Step number. A numbered disc for walking through a page in order; each new one takes the next number.',
    filled: true,
    action: { type: 'shape', kind: 'step' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M10.5 9.5 12.5 8v8" />
      </Glyph>
    ),
  },
  {
    // The stack (docs/specs/009-elements/stack.md): a container that arranges what is dropped into it.
    id: 'tools:stack',
    blurb: 'Lines things up with even gaps',
    caption: 'Stack',
    section: 'build',
    label: 'Add Stack',
    description:
      'Stack. Drop elements in and it lines them up in a row, a column or a grid with even gaps, and reflows as they change.',
    action: { type: 'shape', kind: 'stack' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" strokeDasharray="2.5 2" />
        <rect x="5" y="9" width="4" height="6" rx="1" />
        <rect x="10" y="9" width="4" height="6" rx="1" />
        <rect x="15" y="9" width="4" height="6" rx="1" />
      </Glyph>
    ),
  },
];
