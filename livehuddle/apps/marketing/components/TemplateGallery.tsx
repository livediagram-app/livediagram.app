'use client';

import { ctaHref } from '@livehuddle/api-schema';
import { TemplatePreview } from '@livehuddle/template-previews';
import { templateCreateHref } from '@livehuddle/templates';
import { TemplateGallery as Gallery } from '@liveworkspace/marketing-site/components/TemplateGallery';
import { TemplateCard } from '@/components/TemplateCard';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { LEAD_CATEGORY, galleryShelves, type GalleryTemplate } from '@/lib/template-gallery';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md), anchored #templates for the hero's search: every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Office on load (LEAD_CATEGORY, the gallery's first shelf); every
// other shelf sits folded underneath as a card (its fan drawn from TemplatePreview) that opens it in the open one's
// place, the shelf it replaces folding back in the gallery's order (Blank Slate last). It only
// browses; the editor's wizard (/new) searches every template. Every
// card is a link that creates that document straight away and opens it in the editor (TemplateCard).
// The band itself is @liveworkspace/marketing-site's components/TemplateGallery.tsx: it draws only the open shelf's
// cards, a folded shelf's templates being plain links under the category cards (its TemplateIndex.tsx) until it
// opens. This hands in the shelves, the pieces, the create link and the copy.

// Every shelf, dealt once: the gallery has no filters, so they never change.
const SHELVES = galleryShelves();

// A folded shelf's plain link goes where its card would.
const createHref = (t: GalleryTemplate) => ctaHref(templateCreateHref(t.kind), 'Home.Gallery');

export function TemplateGallery() {
  return (
    <Gallery
      shelves={SHELVES}
      initial={LEAD_CATEGORY}
      eyebrow="One space, many jobs"
      lead="Pick a starting point and you are on the canvas with it already drawn. Every template the editor ships is here."
      Carousel={TemplateCarousel}
      Preview={TemplatePreview}
      Card={TemplateCard}
      href={createHref}
    />
  );
}
