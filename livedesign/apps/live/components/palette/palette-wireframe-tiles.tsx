// The Elements palette's own tiles (docs/specs/007-editor/wireframe-pages.md "The Elements
// palette"): a screen's parts, each one shape placed as its part (packages/document
// shape-variants.ts WIREFRAME_PARTS). The category also lists the Badge, the Card and the
// Checklist (palette-layouts.ts); Text and the Sticky Note stay in Write.
import { Glyph } from '@livedesign/ui';
import type { PaletteTileDef } from './palette-tile-defs';

const G = 18;

export const WIREFRAME_TILES: PaletteTileDef[] = [
  {
    id: 'wireframe:button',
    section: 'wireframe',
    blurb: 'A filled button',
    caption: 'Button',
    label: 'Add Button',
    description: 'A filled button, its word editable. The main action on a screen.',
    action: { type: 'shape', kind: 'square', variant: 'wf-button' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="2.5" y="7" width="19" height="10" rx="3" fill="currentColor" fillOpacity="0.85" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:button-outline',
    section: 'wireframe',
    blurb: 'An outlined button',
    caption: 'Outline',
    label: 'Add Outline Button',
    description: 'An outlined button, for a second action beside the main one.',
    action: { type: 'shape', kind: 'square', variant: 'wf-button-outline' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="2.5" y="7" width="19" height="10" rx="3" />
        <path d="M8 12h8" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:field',
    section: 'wireframe',
    blurb: 'An input with a placeholder',
    caption: 'Field',
    label: 'Add Text Field',
    description: 'An outlined text field with a muted placeholder.',
    action: { type: 'shape', kind: 'square', variant: 'wf-field' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="2.5" y="7" width="19" height="10" rx="2" />
        <path d="M6 10v4" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:search',
    section: 'wireframe',
    blurb: 'A pill search field',
    caption: 'Search',
    label: 'Add Search Field',
    description: 'A rounded search field with its glass and a placeholder.',
    action: { type: 'shape', kind: 'square', variant: 'wf-search' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="2.5" y="7" width="19" height="10" rx="5" />
        <circle cx="8" cy="11.5" r="2" />
        <path d="M9.5 13l1.3 1.3" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:image',
    section: 'wireframe',
    blurb: 'A grey picture placeholder',
    caption: 'Image',
    label: 'Add Image Placeholder',
    description: 'A grey block marking where a picture goes.',
    action: { type: 'shape', kind: 'square', variant: 'wf-image' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="3" y="4.5" width="18" height="15" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M21 16l-5-5-8 8.5" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:avatar',
    section: 'wireframe',
    blurb: 'A round avatar',
    caption: 'Avatar',
    label: 'Add Avatar Placeholder',
    description: 'A round avatar holding initials.',
    action: { type: 'shape', kind: 'circle', variant: 'wf-avatar' },
    icon: (
      <Glyph size={G} units={24}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="10" r="2.6" />
        <path d="M7.5 17.5c1-2.2 2.6-3.2 4.5-3.2s3.5 1 4.5 3.2" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:chip',
    section: 'wireframe',
    blurb: 'A pill-shaped chip',
    caption: 'Chip',
    label: 'Add Chip',
    description: 'A small pill for a filter, a tag or a choice.',
    action: { type: 'shape', kind: 'square', variant: 'wf-chip' },
    icon: (
      <Glyph size={G} units={24}>
        <rect x="4" y="8.5" width="16" height="7" rx="3.5" />
      </Glyph>
    ),
  },
  {
    id: 'wireframe:divider',
    section: 'wireframe',
    blurb: 'A thin rule',
    caption: 'Divider',
    label: 'Add Divider',
    description: 'A thin rule between parts of a screen.',
    action: { type: 'shape', kind: 'square', variant: 'wf-divider' },
    icon: (
      <Glyph size={G} units={24}>
        <path d="M3 12h18" />
      </Glyph>
    ),
  },
];
