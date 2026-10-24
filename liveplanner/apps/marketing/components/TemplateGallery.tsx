'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CategoryTiles } from '@/components/CategoryTiles';
import { TemplateCard } from '@/components/TemplateCard';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { galleryShelves, type ShelfId } from '@/lib/template-gallery';
import { shelfScrollTarget } from '@liveworkspace/marketing-site/lib/shelf-scroll';
import {
  BAND_LEAD,
  BAND_SECTION,
  BAND_TITLE,
} from '@liveworkspace/marketing-site/lib/band-classes';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md), anchored #templates for the hero's search: every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Blank Slate on load (every blank and nothing else: each mode's and Blank
// Spreadsheet); every other category sits folded underneath as a card (CategoryTiles) that opens it
// in the open one's place, the shelf it replaces folding back (Blank Slate leading the folds). It only
// browses: the search is the hero's (components/HeroSearch.tsx), which finds across every shelf. Every
// card is a link that creates that project straight away and opens it in the editor (TemplateCard).

// Every shelf, dealt once: the gallery has no filters, so they never change.
const SHELVES = galleryShelves();

export function TemplateGallery() {
  // The open shelf; Blank Slate until the visitor opens another.
  const [openId, setOpenId] = useState<ShelfId>('popular');
  // Whether the open shelf was opened by the visitor (it rises in) or is the load's.
  const [opened, setOpened] = useState(false);
  const openShelf = SHELVES.find((s) => s.id === openId) ?? SHELVES[0];
  const open = openShelf ? [openShelf] : [];
  const folded = SHELVES.filter((s) => s !== openShelf);
  const openCategory = (id: ShelfId) => {
    setOpenId(id);
    setOpened(true);
  };
  // A shelf the visitor opens is brought into view when it is not (@liveworkspace/marketing-site's lib/shelf-scroll.ts): it opens
  // above the cards, so from a card lower down it would open out of sight. Smooth, at once under
  // reduced motion.
  const shelfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = shelfRef.current;
    if (!opened || !el) return;
    const to = shelfScrollTarget(el.getBoundingClientRect(), window.innerHeight, window.scrollY);
    if (to === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: to, behavior: reduce ? 'auto' : 'smooth' });
  }, [openId, opened]);

  return (
    <section id="templates" className={`${BAND_SECTION} scroll-mt-[72px]`}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>One plan, many tabs</p>
          <h2 className={BAND_TITLE}>Browse every template</h2>
          <p className={BAND_LEAD}>
            Pick a starting point and your new plan opens with its boards, sheets and forms already
            set up. Every plan template is here.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-10">
          <div ref={shelfRef}>
            {open.map((shelf) => (
              <TemplateCarousel
                key={shelf.id}
                label={shelf.label}
                count={shelf.templates.length}
                itemsKey={shelf.templates.map((t) => t.kind).join(',')}
                reveal={opened}
              >
                {shelf.templates.map((t, i) => (
                  <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                    <TemplateCard template={t} source="Home.Gallery" />
                  </li>
                ))}
              </TemplateCarousel>
            ))}
          </div>
          {folded.length > 0 ? <CategoryTiles groups={folded} onOpen={openCategory} /> : null}
        </div>
      </div>
    </section>
  );
}
