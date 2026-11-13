'use client';

import { TemplateGallery as Gallery } from '@liveworkspace/marketing-site/components/TemplateGallery';
import { CategoryTiles } from '@/components/CategoryTiles';
import { TemplateCard } from '@/components/TemplateCard';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { galleryShelves } from '@/lib/template-gallery';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md), anchored #templates for the hero's search: every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Blank Slate on load (every blank and nothing else: the empty page and a
// blank of each page kind); every other category sits folded underneath as a card (CategoryTiles) that opens it
// in the open one's place, the shelf it replaces folding back (Blank Slate leading the folds). It only
// browses: the search is the hero's (components/HeroSearch.tsx), which finds across every shelf. Every
// card is a link that creates that design straight away and opens it in the editor (TemplateCard).
// The band itself is @liveworkspace/marketing-site's components/TemplateGallery.tsx; this hands in the shelves,
// the pieces and the copy.

// Every shelf, dealt once: the gallery has no filters, so they never change.
const SHELVES = galleryShelves();

export function TemplateGallery() {
  return (
    <Gallery
      shelves={SHELVES}
      initial="popular"
      eyebrow="One canvas, many jobs"
      lead="Pick a starting point and you are on the canvas with it already drawn. Every template the editor ships is here."
      Carousel={TemplateCarousel}
      Tiles={CategoryTiles}
      Card={TemplateCard}
    />
  );
}
