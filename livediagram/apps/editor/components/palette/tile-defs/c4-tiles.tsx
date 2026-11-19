import { Glyph } from '@livediagram/ui';
import { ELEMENT_TILES } from './element-tiles';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The C4 model's tiles (docs/specs/010-palette/build-category.md "The C4 model"): a Card or a Cylinder dressed as
// one kind of C4 element (packages/document c4-look.ts), in C4's own colours, which keep under every theme. Offered
// in Diagram's Layout through the Infrastructure tile's popover (below). Their descriptions
// carry what people search for them by: C4, Structurizr, container.

const C4_SEARCH = 'C4 model, Structurizr.';

export const C4_TILES: PaletteTileDef[] = [
  {
    id: 'diagrams:c4-person',
    blurb: 'Someone who uses the system',
    caption: 'Person',
    section: 'diagrams',
    label: 'Add C4 Person',
    description: `C4 person. A user of the software system, in the C4 deep blue. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'card', variant: 'c4-person' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M4.5 20.5v-2a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v2Z" />
      </Glyph>
    ),
  },
  {
    id: 'diagrams:c4-system',
    blurb: 'The software system in focus',
    caption: 'Software System',
    section: 'diagrams',
    label: 'Add C4 Software System',
    description: `C4 software system. The system a System Context diagram is about, with what it does. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'card', variant: 'c4-system' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M7 10h10M7 14h6" />
      </Glyph>
    ),
  },
  {
    id: 'diagrams:c4-container',
    blurb: 'An app, service or store',
    caption: 'Container',
    section: 'diagrams',
    label: 'Add C4 Container',
    description: `C4 container. An app, a service or a store inside the system, with its technology. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'card', variant: 'c4-container' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <rect x="6.5" y="8" width="11" height="8" rx="1.5" />
      </Glyph>
    ),
  },
  {
    id: 'diagrams:c4-component',
    blurb: 'A part inside one container',
    caption: 'Component',
    section: 'diagrams',
    label: 'Add C4 Component',
    description: `C4 component. A part of one container, with its responsibility and technology. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'card', variant: 'c4-component' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="6" y="4" width="15" height="16" rx="2" />
        <rect x="3" y="7.5" width="6" height="3" rx="0.8" />
        <rect x="3" y="13.5" width="6" height="3" rx="0.8" />
      </Glyph>
    ),
  },
  {
    id: 'diagrams:c4-external',
    blurb: 'A system outside, in grey',
    caption: 'External System',
    section: 'diagrams',
    label: 'Add C4 External System',
    description: `C4 external system. Something the system depends on but does not own, in grey. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'card', variant: 'c4-external' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" strokeDasharray="3 2.5" />
        <circle cx="12" cy="12" r="3.5" />
      </Glyph>
    ),
  },
  {
    id: 'diagrams:c4-database',
    blurb: 'A database container',
    caption: 'Database',
    section: 'diagrams',
    label: 'Add C4 Database',
    description: `C4 database. A container that stores data, as a cylinder with its technology. ${C4_SEARCH}`,
    action: { type: 'shape', kind: 'cylinder', variant: 'c4-database' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <ellipse cx="12" cy="6" rx="7.5" ry="2.5" />
        <path d="M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" />
      </Glyph>
    ),
  },
];

// Layout's Infrastructure tile (owner, 2026-11-19; docs/specs/010-palette/build-category.md "The C4 model"): one tile
// in Parts beside the Card and the Badge whose popover offers the C4 tiles and the Entity, as the Card's offers its
// presets. Pressed anywhere without a popover (search, a rail), it places the Software System.
const ENTITY_TILE = ELEMENT_TILES.find((t) => t.id === 'tools:entity');

export const INFRASTRUCTURE_TILE: PaletteTileDef = {
  id: 'layout:infrastructure',
  blurb: 'C4 people, systems, containers and entities',
  caption: 'Infrastructure',
  section: 'diagrams',
  label: 'Add Infrastructure',
  description: `Infrastructure. The C4 Person, Software System, Container, Component, External System and Database, and the Entity. ${C4_SEARCH}`,
  action: { type: 'shape', kind: 'card', variant: 'c4-system' },
  variants: ENTITY_TILE ? [...C4_TILES, ENTITY_TILE] : C4_TILES,
  variantsHint: 'Pick a C4 element or an Entity; its text and colours can change once placed.',
  icon: (
    <Glyph size={TILE_GLYPH_PX} units={24}>
      <rect x="4" y="3.5" width="16" height="6" rx="1.5" />
      <rect x="4" y="14.5" width="16" height="6" rx="1.5" />
      <path d="M12 9.5v5M7.5 6.5h.01M7.5 17.5h.01" />
    </Glyph>
  ),
};
