import {
  SETUP_STRUCTURES,
  STRUCTURE_GROUPS,
  setupStructure,
  structureOutline,
  structurePageCount,
  type StructureGroup,
} from '@liveknowledge/knowledge';
import { BLANK_TEMPLATE } from '@liveknowledge/templates';

// The landing page's template gallery (docs/specs/019-marketing/marketing-site.md "Structure" 3): liveknowledge's
// templates are knowledgebase structures (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"),
// whole trees of pages, the same thirty-two the editor's start offers. One shelf per structure group, in the start's
// order, each card a link that makes a new knowledgebase from that structure straight away (/new?structure=<id>,
// docs/specs/007-editor/new-document-route.md "The other parameters"), with Blank Knowledgebase leading the group
// tiles as a link that makes one (no shelf of its own). The data half lives here so it can be tested without
// rendering the section.

/** One structure as the gallery deals it: `kind` and `title` are what the shared band keys and indexes it by. */
export type GalleryStructure = {
  kind: string;
  title: string;
  line: string;
  pageCount: number;
  outline: ReturnType<typeof structureOutline>;
};

export type ShelfId = StructureGroup;

export type GalleryShelf = { id: ShelfId; label: string; templates: GalleryStructure[] };

/** A structure by its id, as the gallery deals it; null for an id no structure has. */
export function galleryStructure(id: string): GalleryStructure | null {
  const structure = setupStructure(id);
  if (!structure) return null;
  return {
    kind: structure.id,
    title: structure.name,
    line: structure.line,
    pageCount: structurePageCount(structure),
    outline: structureOutline(structure),
  };
}

/** Every structure group as a shelf, in the start's order, each structure on its own group's shelf once. */
export function galleryShelves(): GalleryShelf[] {
  return STRUCTURE_GROUPS.map((g) => ({
    id: g.id,
    label: g.name,
    templates: SETUP_STRUCTURES.filter((s) => s.group === g.id).map((s) => galleryStructure(s.id)!),
  }));
}

/** Where a structure's card goes: a new knowledgebase made from it. */
export const structureCreateHref = (id: string): string =>
  `/new?structure=${encodeURIComponent(id)}`;

// The tile that leads the group tiles and creates a blank knowledgebase straight away.
export const BLANK_START = {
  label: 'Blank Knowledgebase',
  kind: BLANK_TEMPLATE,
  note: 'Start empty',
} as const;
