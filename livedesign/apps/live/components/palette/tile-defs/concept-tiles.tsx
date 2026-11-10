import { Glyph } from '@livedesign/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Concepts tiles and the elements filed after them: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const CONCEPT_TILES: PaletteTileDef[] = [
  // --- Concepts (docs/specs/009-elements/concept-graphics.md) --------------------------------------
  {
    id: 'concepts:layer-stack',
    blurb: 'Stacked layers with side notes',
    caption: 'Layer Stack',
    section: 'concepts',
    label: 'Add Layer Stack',
    description:
      'Layer stack. Horizontal bands for a tech stack, the OSI model or architecture tiers.',
    action: { type: 'shape', kind: 'layer-stack' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="3.5" width="18" height="4.5" rx="1.2" />
        <rect x="3" y="9.75" width="18" height="4.5" rx="1.2" />
        <rect x="3" y="16" width="18" height="4.5" rx="1.2" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:pyramid',
    blurb: 'Tiers in a triangle',
    caption: 'Pyramid',
    section: 'concepts',
    label: 'Add Pyramid',
    description: 'Pyramid. Tiers cut from one triangle: a hierarchy, a strategy stack, needs.',
    action: { type: 'shape', kind: 'pyramid' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M12 3 15.4 9H8.6Z" />
        <path d="M7.7 10.6h8.6l2.9 5H4.8Z" />
        <path d="M3.9 17.2h16.2l1.4 3.3h-19Z" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:funnel',
    blurb: 'Narrowing bands with values',
    caption: 'Funnel',
    section: 'concepts',
    label: 'Add Funnel',
    description: 'Funnel. Bands narrowing downward, each with a value: a conversion story.',
    action: { type: 'shape', kind: 'pyramid', variant: 'funnel' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M3 4h18l-2.2 4.5H5.2Z" />
        <path d="M6 10.5h12l-2 4H8Z" />
        <path d="M8.8 16.5h6.4l-1.2 3.5h-4Z" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:cycle',
    blurb: 'Steps round a loop',
    caption: 'Cycle',
    section: 'concepts',
    label: 'Add Cycle',
    description: 'Cycle. Steps round a ring joined by arrows: PDCA, a flywheel, a release loop.',
    action: { type: 'shape', kind: 'cycle' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="4.5" r="2.3" />
        <circle cx="19.5" cy="12" r="2.3" />
        <circle cx="12" cy="19.5" r="2.3" />
        <circle cx="4.5" cy="12" r="2.3" />
        <path d="M15 5.5a8 8 0 0 1 3.5 3.5M18.5 15a8 8 0 0 1-3.5 3.5M9 18.5A8 8 0 0 1 5.5 15M5.5 9A8 8 0 0 1 9 5.5" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:hub',
    blurb: 'Satellites round a centre',
    caption: 'Hub and Spoke',
    section: 'concepts',
    label: 'Add Hub and Spoke',
    description:
      'Hub and spoke. Satellites round a central hub, joined by spokes: an ecosystem, stakeholders, integrations.',
    action: { type: 'shape', kind: 'hub' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="3.5" r="1.8" />
        <circle cx="19.4" cy="16.2" r="1.8" />
        <circle cx="4.6" cy="16.2" r="1.8" />
        <path d="M12 8.8V5.3M14.8 13.6l3 1.7M9.2 13.6l-3 1.7" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:onion',
    blurb: 'Rings from a core outward',
    caption: 'Onion',
    section: 'concepts',
    label: 'Add Onion',
    description:
      'Onion rings. Concentric rings from a core outward: clean architecture, trust layers, a maturity model.',
    action: { type: 'shape', kind: 'onion' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="3" />
      </Glyph>
    ),
  },
  {
    id: 'concepts:chevrons',
    blurb: 'Arrow-shaped stages in a row',
    caption: 'Chevrons',
    section: 'concepts',
    label: 'Add Chevrons',
    description:
      'Chevron process. Arrow-shaped stages in a row, each pointing into the next: a pipeline, a value chain, phases.',
    action: { type: 'shape', kind: 'chevrons' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M2 8h5l2.5 4L7 16H2l2.5-4Z" />
        <path d="M9 8h5l2.5 4L14 16H9l2.5-4Z" />
        <path d="M16 8h4.5l2 4-2 4H16l2.5-4Z" />
      </Glyph>
    ),
  },
  {
    // The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"). Its id is the one it had in Build, so a
    // palette layout that pinned it keeps it.
    id: 'tools:timeline',
    blurb: 'Milestones along a line, when and what',
    caption: 'Timeline',
    section: 'concepts',
    label: 'Add Timeline',
    description:
      'Timeline. Milestones along a line, each with when and what, taking turns above and below: a roadmap, a project plan, a history.',
    action: { type: 'shape', kind: 'timeline-rail' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M2 12h18" />
        <path d="m20 9.5 2.5 2.5-2.5 2.5" />
        <circle cx="5.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="11" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
        <path d="M5.5 9.5V6M11 14.5V18M16.5 9.5V6" />
      </Glyph>
    ),
  },
  {
    id: 'tools:annotation',
    blurb: 'A marker that holds a note',
    section: 'tools',
    // Last in Write, and the odd one out in it: an annotation is a MARKER you
    // drop on the canvas that happens to hold text, not a surface you write
    // on like Text, a sticky or a Page. It briefly sat in its own Blocks group
    // for exactly that reason, but docs/specs/010-palette/palette-top-level-categories.md emptied Blocks out and deleted it,
    // so Write is where it lives — ordered last, after the three surfaces,
    // which is the distinction the row order now carries.
    toolGroup: 'write',
    label: 'Add Annotation',
    description: 'Annotation. A note marker: hover to read it, double-click to edit.',
    filled: true,
    action: { type: 'annotation' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
        <path d="M6.5 9.75h11" />
        <path d="M6.5 12.5h7" />
      </Glyph>
    ),
  },
  {
    // The pointer note (docs/specs/009-elements/pointer-note.md): a note whose leader's tip pins to a point on a shape.
    id: 'tools:pointer-note',
    blurb: 'A note that points at a spot',
    caption: 'Pointer Note',
    section: 'tools',
    toolGroup: 'write',
    label: 'Add Pointer Note',
    description:
      'Pointer note. A short note with a line to a dot; drag the dot onto a corner or edge of a shape and the note follows it.',
    filled: true,
    action: { type: 'shape', kind: 'pointer-note' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="9" y="3" width="12.5" height="8" rx="2" />
        <path d="M11.5 6h7.5M11.5 8.5h4.5" />
        <path d="M9 11 4.5 18" />
        <circle cx="4" cy="19" r="1.6" fill="currentColor" />
      </Glyph>
    ),
  },
  {
    id: 'tools:link-card',
    blurb: 'A clickable preview of a link',
    // Media, beside the embeds: each shows another page inside this one. It sat under Components, which groups by
    // what a thing looks like — a ready-made composite you recolour — and a link card is neither composite nor
    // decoration.
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
  {
    // Sankey diagram (docs/specs/009-elements/sankey.md): last in Build, after the containers, because it is
    // the one Build element that lays itself out from data rather than holding work you place in it.
    id: 'tools:sankey',
    blurb: 'Flows drawn as wide as the amount they carry',
    caption: 'Sankey',
    section: 'build',
    label: 'Add Sankey Diagram',
    description:
      'A Sankey diagram: how much moves where, each band as wide as its amount. Double-click it to edit the flows.',
    action: { type: 'shape', kind: 'sankey' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        {/* Two inputs merging into a node, splitting three ways: the shape of every Sankey. */}
        <path d="M3 5h2M3 13h2M11 7v10M19 4v4M19 11v3M19 17v3" />
        <path d="M5 4c4 0 2 4 6 4M5 14c4 0 2 2 6 2M11 9c4 0 4-3 8-3M11 12c4 0 4 0 8 1M11 15c4 0 4 3 8 3" />
      </Glyph>
    ),
  },
];
