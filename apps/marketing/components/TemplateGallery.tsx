'use client';

import { TemplatePreview } from '@livediagram/template-previews';
import { ctaHref } from '@livediagram/api-schema';
import { templateCreateHref } from '@livediagram/templates';
import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { useState, type CSSProperties } from 'react';
import { CategoryTiles } from '@/components/CategoryTiles';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { galleryShelves, type ShelfId } from '@/lib/template-gallery';
import {
  BAND_CARD,
  BAND_CONTROL_HOVER,
  BAND_LEAD,
  BAND_SECTION,
  BAND_TITLE,
} from '@/components/band-classes';
import { EYEBROW } from '@/components/eyebrow';

// "Browse every template" (docs/specs/019-marketing/marketing-site.md), anchored #templates for the hero's search: every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Blank Slate on load (every blank and nothing else: each mode's and Blank
// Spreadsheet); every other category sits folded underneath as a card (CategoryTiles) that opens it
// in the open one's place, the shelf it replaces folding back (Blank Slate leading the folds). It only
// browses: the search is the hero's (components/HeroSearch.tsx), which finds across every shelf. Every
// card is a link that creates that document straight away and opens it in the editor
// (/new?template=<kind>, docs/specs/007-editor/new-document-route.md), and wears its mode's glyph
// beside its title. The cards' artwork is the editor picker's own preview
// (@livediagram/template-previews), so a template looks the same here as it does in the app.

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

  return (
    <section id="templates" className={`${BAND_SECTION} scroll-mt-[72px]`}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>One canvas, many jobs</p>
          <h2 className={BAND_TITLE}>Browse every template</h2>
          <p className={BAND_LEAD}>
            Pick a starting point and you are on the canvas with it already drawn. Every template
            the editor ships is here.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-10">
          {open.map((shelf) => (
            <TemplateCarousel
              key={shelf.id}
              label={shelf.label}
              count={shelf.templates.length}
              itemsKey={shelf.templates.map((t) => t.kind).join(',')}
              reveal={opened}
            >
              {shelf.templates.map((t, i) => {
                const ModeIcon = EDITOR_MODE_ICONS[t.mode];
                return (
                  <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                    <a
                      href={ctaHref(templateCreateHref(t.kind), 'Home.Gallery')}
                      className={`preview-motion-host group flex h-full flex-col p-3 ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
                    >
                      {/* The picker's preview, drawn for a light tile and re-lit onto the dark
                            canvas colour in dark by the editor's own rule (preview-art-tile),
                            scaled up from its fixed picker size. */}
                      <span className="preview-art-tile preview-motion flex h-24 items-center justify-center rounded-xl bg-slate-50 [&>svg]:h-16 [&>svg]:w-auto">
                        <TemplatePreview kind={t.kind} />
                      </span>
                      <span className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {/* The mode the template opens in, as the editor's cards show it (the
                              link's own name already says what it makes). */}
                        <ModeIcon
                          size={14}
                          aria-hidden
                          className="shrink-0 text-slate-500 dark:text-slate-400"
                        />
                        {/* The link's name is its own text, "Create a Blank Diagram" and the
                              description, so its visible title is part of it (WCAG 2.5.3). */}
                        <span className="sr-only">Create a </span>
                        {t.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {t.description}
                      </span>
                    </a>
                  </li>
                );
              })}
            </TemplateCarousel>
          ))}
          {folded.length > 0 ? <CategoryTiles groups={folded} onOpen={openCategory} /> : null}
        </div>
      </div>
    </section>
  );
}
