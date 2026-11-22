'use client';

import { TemplateGallery as Gallery } from '@liveworkspace/marketing-site/components/TemplateGallery';
import { ctaHref } from '@liveknowledge/api-schema';
import { templateCreateHref } from '@liveknowledge/templates';
import { StructureCard } from '@/components/StructureCard';
import { StructurePreview } from '@/components/StructurePreview';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import {
  BLANK_START,
  galleryShelves,
  structureCreateHref,
  type GalleryStructure,
} from '@/lib/template-gallery';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md "Structure" 3), anchored #templates: the
// knowledgebase structures, liveknowledge's templates, the same thirty-two a new knowledgebase's start offers. ONE group
// is open as a four-across carousel (TemplateCarousel), Company on load; Blank Knowledgebase leads the
// folded tiles as a link that makes a blank knowledgebase at once (no group); every other group sits folded
// underneath as a tile that opens it in the open one's place, fanning its structures' trees (StructurePreview).
// Every card is the structure's outline and a link that makes a new knowledgebase from it straight away
// (StructureCard). The band itself is @liveworkspace/marketing-site's components/TemplateGallery.tsx, unchanged: it
// draws only the open shelf's cards, a folded shelf's structures being plain links under the tiles until it opens.
// This hands in the shelves, the pieces, the create link and the copy.

// Every shelf, dealt once: the gallery has no filters, so they never change.
const SHELVES = galleryShelves();

// Blank Knowledgebase leads the group tiles but is no group: it makes a blank knowledgebase at once.
const START = {
  ...BLANK_START,
  href: ctaHref(templateCreateHref(BLANK_START.kind), 'Home.Gallery'),
};

// A folded shelf's plain link goes where its card would.
const createHref = (t: GalleryStructure) => ctaHref(structureCreateHref(t.kind), 'Home.Gallery');

export function TemplateGallery() {
  return (
    <Gallery
      shelves={SHELVES}
      initial={SHELVES[0]!.id}
      eyebrow="Start From a Template"
      lead="Every template is a whole knowledgebase: its pages already in a tree, each with a line on what belongs there and the headings to write under. Pick one and the knowledgebase is ready to fill in."
      Carousel={TemplateCarousel}
      Preview={StructurePreview}
      Card={StructureCard}
      href={createHref}
      start={START}
    />
  );
}
