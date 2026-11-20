'use client';

import { TemplateGallery as Gallery } from '@liveworkspace/marketing-site/components/TemplateGallery';
import { ctaHref } from '@liveknowledge/api-schema';
import { TemplatePreview } from '@liveknowledge/template-previews';
import { templateCreateHref } from '@liveknowledge/templates';
import { TemplateCard } from '@/components/TemplateCard';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { galleryShelves, type GalleryTemplate } from '@/lib/template-gallery';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md "Structure" 6), anchored #templates: every
// template the editor ships, writing only, laid out as the editor's template step lays them out. ONE shelf is open
// as a four-across carousel (TemplateCarousel), Blank Slate on load; every category (Engineering, Handbooks,
// Onboarding, Product, Support) sits folded underneath as a card that opens it in the open one's place. Every card
// is a link that creates that page straight away and opens it in the editor (TemplateCard). The band itself is
// @liveworkspace/marketing-site's components/TemplateGallery.tsx: it draws only the open shelf's cards, a folded
// shelf's templates being plain links under the category cards until it opens. This hands in the shelves, the
// pieces, the create link and the copy.

// Every shelf, dealt once: the gallery has no filters, so they never change.
const SHELVES = galleryShelves();

// A folded shelf's plain link goes where its card would.
const createHref = (t: GalleryTemplate) => ctaHref(templateCreateHref(t.kind), 'Home.Gallery');

export function TemplateGallery() {
  return (
    <Gallery
      shelves={SHELVES}
      initial="popular"
      eyebrow="Start From a Template"
      lead="Pick a starting point and you are writing on a page that already has its headings. Every template is a page of writing, filed by what it is for."
      Carousel={TemplateCarousel}
      Preview={TemplatePreview}
      Card={TemplateCard}
      href={createHref}
    />
  );
}
