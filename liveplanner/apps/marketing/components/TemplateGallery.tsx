'use client';

import { TemplateGallery as Gallery } from '@liveworkspace/marketing-site/components/TemplateGallery';
import { ctaHref } from '@liveplanner/api-schema';
import { TemplatePreview } from '@liveplanner/template-previews';
import { templateCreateHref } from '@liveplanner/templates';
import { TemplateCard } from '@/components/TemplateCard';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { galleryShelves, type GalleryTemplate } from '@/lib/template-gallery';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md), anchored #templates for the hero's search: every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Blank Slate on load (every blank and nothing else: each mode's and Blank
// Spreadsheet); every other category sits folded underneath as a card (its fan drawn from TemplatePreview) that opens it
// in the open one's place, the shelf it replaces folding back (Blank Slate leading the folds). It only
// browses: the search is the hero's (components/HeroSearch.tsx), which finds across every shelf. Every
// card is a link that creates that project straight away and opens it in the editor (TemplateCard).
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
      initial="popular"
      eyebrow="One plan, many tabs"
      lead="Pick a starting point and your new plan opens with its boards, sheets and forms already set up. Every plan template is here."
      Carousel={TemplateCarousel}
      Preview={TemplatePreview}
      Card={TemplateCard}
      href={createHref}
    />
  );
}
