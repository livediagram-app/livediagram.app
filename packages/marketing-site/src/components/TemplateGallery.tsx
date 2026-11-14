'use client';

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { BAND_LEAD, BAND_SECTION, BAND_TITLE } from '../lib/band-classes';
import { EYEBROW } from '../lib/eyebrow';
import { shelfScrollTarget } from '../lib/shelf-scroll';
import { CategoryTiles } from './CategoryTiles';
import { TemplateIndex, indexedTemplates } from './TemplateIndex';

// "Browse every template" (each product's docs/specs/019-marketing/marketing-site.md), anchored #templates for the
// hero's search: every template the editor ships, laid out as the editor's template step lays them out. ONE shelf
// is open as a four-across carousel (the product's TemplateCarousel), the `initial` one on load; every other
// category sits folded underneath as a card (CategoryTiles.tsx, its fan the product's previews) that opens it in the open one's
// place, the shelf it replaces folding back. Only the open shelf's cards are drawn: a folded shelf's cards are rendered
// when it opens, so the page's HTML does not grow with the catalogue, and its templates stay in the HTML as plain
// links under the category cards (TemplateIndex.tsx), so every template is still a link a crawler can follow. It only browses: the search is the hero's, which finds across every shelf.
// Every card (the product's TemplateCard) is a link that creates that template straight away in the editor.
// Each product's components/TemplateGallery.tsx hands in its shelves, its pieces, its create link and its copy.

export type GalleryItem = { kind: string; title: string };

export type TemplateShelf<Id extends string, T extends { kind: string }> = {
  id: Id;
  label: string;
  templates: T[];
};

export type TemplateGalleryProps<Id extends string, T extends GalleryItem> = {
  /** Every shelf, dealt once by the caller: the gallery has no filters, so they never change. */
  shelves: readonly TemplateShelf<Id, T>[];
  /** The shelf open on load. */
  initial: Id;
  eyebrow: string;
  lead: ReactNode;
  Carousel: ComponentType<{
    label: string;
    count: number;
    itemsKey: string;
    reveal?: boolean;
    children: ReactNode;
  }>;
  /** The product's preview of one template (its TemplatePreview), fanned on each folded category's card. */
  Preview: ComponentType<{ kind: T['kind'] }>;
  Card: ComponentType<{ template: T; source: 'Home.Gallery' }>;
  /** Where a template's plain link goes: the same create link as its card. */
  href: (template: T) => string;
};

export function TemplateGallery<Id extends string, T extends GalleryItem>({
  shelves,
  initial,
  eyebrow,
  lead,
  Carousel,
  Preview,
  Card,
  href,
}: TemplateGalleryProps<Id, T>) {
  // The open shelf; the initial one until the visitor opens another.
  const [openId, setOpenId] = useState<Id>(initial);
  // Whether the open shelf was opened by the visitor (it rises in) or is the load's.
  const [opened, setOpened] = useState(false);
  const openShelf = shelves.find((s) => s.id === openId) ?? shelves[0];
  const open = openShelf ? [openShelf] : [];
  const folded = shelves.filter((s) => s !== openShelf);
  const openCategory = (id: Id) => {
    setOpenId(id);
    setOpened(true);
  };
  // A shelf the visitor opens is brought into view when it is not (lib/shelf-scroll.ts): it opens above the
  // cards, so from a card lower down it would open out of sight. Smooth, at once under reduced motion.
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
          <p className={EYEBROW}>{eyebrow}</p>
          <h2 className={BAND_TITLE}>Browse every template</h2>
          <p className={BAND_LEAD}>{lead}</p>
        </div>

        <div className="mt-12 flex flex-col gap-10">
          <div ref={shelfRef}>
            {open.map((shelf) => (
              <Carousel
                key={shelf.id}
                label={shelf.label}
                count={shelf.templates.length}
                itemsKey={shelf.templates.map((t) => t.kind).join(',')}
                reveal={opened}
              >
                {shelf.templates.map((t, i) => (
                  <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                    <Card template={t} source="Home.Gallery" />
                  </li>
                ))}
              </Carousel>
            ))}
          </div>
          {folded.length > 0 ? (
            <div className="flex flex-col gap-4">
              <CategoryTiles groups={folded} onOpen={openCategory} Preview={Preview} />
              <TemplateIndex
                templates={indexedTemplates(folded, openShelf?.templates ?? [])}
                href={href}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
