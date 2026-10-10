'use client';

import { editorModeLabel } from '@livediagram/document';
import { TemplatePreview } from '@livediagram/template-previews';
import { ctaHref } from '@livediagram/api-schema';
import { templateCreateHref } from '@livediagram/templates';
import { EDITOR_MODE_ICONS, EverythingIcon, Glyph, ModeFilterMenu } from '@livediagram/ui';
import { useState, type CSSProperties } from 'react';
import { CategoryTiles } from '@/components/CategoryTiles';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import {
  galleryShelves,
  modeCounts,
  searchShelves,
  type ModeChoice,
  type ShelfId,
} from '@/lib/template-gallery';
import {
  BAND_CARD,
  BAND_CONTROL_HOVER,
  BAND_EYEBROW,
  BAND_LEAD,
  BAND_SECTION,
  BAND_TITLE,
} from '@/components/band-classes';

// "What do you want to create?" (docs/specs/019-marketing/marketing-site.md): every template the
// editor ships, laid out as the editor's template step lays them out
// (docs/specs/008-canvas/canvas-and-palette.md "Templates"). ONE shelf is open as a four-across
// carousel (TemplateCarousel), Popular on load (the four blanks, then the starters most people
// reach for); every other category sits folded underneath as a card (CategoryTiles) that opens it
// in the open one's place, the shelf it replaces folding back (Popular leading the folds). Beside
// the search box, the mode filter (the editor's own ModeFilterMenu) narrows every view to one
// editor mode's templates, Everything on load. A search shows every matching shelf at once. Every
// card is a link that creates that document straight away and opens it in the editor
// (/new?template=<kind>, docs/specs/007-editor/new-document-route.md), and wears its mode's glyph
// beside its title. The cards' artwork is the editor picker's own preview
// (@livediagram/template-previews), so a template looks the same here as it does in the app.

const COUNTS = modeCounts();
const CHOICES: readonly ModeChoice[] = ['all', 'diagram', 'draw', 'illustrate', 'plan'];
const choiceLabel = (c: ModeChoice) => (c === 'all' ? 'Everything' : editorModeLabel(c));

export function TemplateGallery() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ModeChoice>('all');
  // The open shelf; Popular until the visitor opens another.
  const [openId, setOpenId] = useState<ShelfId>('popular');
  // Whether the open shelf was opened by the visitor (it rises in) or is the load's.
  const [opened, setOpened] = useState(false);
  const searching = query.trim() !== '';
  const shelves = searching ? searchShelves(query, mode) : galleryShelves(mode);
  // The open shelf falls back to the first left under the filter (Popular, when it has any).
  const openShelf = shelves.find((s) => s.id === openId) ?? shelves[0];
  const open = searching ? shelves : openShelf ? [openShelf] : [];
  const folded = searching ? [] : shelves.filter((s) => s !== openShelf);
  const openCategory = (id: ShelfId) => {
    setOpenId(id);
    setOpened(true);
  };

  return (
    <section className={BAND_SECTION}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={BAND_EYEBROW}>One canvas, many jobs</p>
          <h2 className={BAND_TITLE}>What do you want to create?</h2>
          <p className={BAND_LEAD}>
            Pick a starting point and you are on the canvas with it already drawn. Every template
            the editor ships is here.
          </p>
        </div>

        {/* The mode filter, then the search box: one row from `sm`, the filter on its own row
            above on a phone so the search keeps its width. Not the shared TextInput: this is the
            band's larger, rounder search field. */}
        <div className="mx-auto mt-10 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch">
          <ModeFilterMenu
            label="Show templates for"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setOpened(false);
            }}
            options={CHOICES.map((c) => ({
              id: c,
              label: choiceLabel(c),
              Icon: c === 'all' ? EverythingIcon : EDITOR_MODE_ICONS[c],
              count: COUNTS[c],
            }))}
          />
          <div className="relative min-w-0 flex-1">
            <label htmlFor="template-gallery-search" className="sr-only">
              Search templates
            </label>
            <SearchIcon />
            <input
              id="template-gallery-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates, e.g. flowchart, retro, poster"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>
        </div>

        {shelves.length === 0 ? (
          <p className="mt-12 text-center text-slate-600 dark:text-slate-400">
            Nothing matches &ldquo;{query.trim()}&rdquo;
            {mode === 'all' ? '' : ` in ${choiceLabel(mode)}`}. Try a different word
            {mode === 'all' ? '' : ' or Everything'}, or{' '}
            <a
              href={ctaHref('/new?blank=1', 'Home.GalleryDraw')}
              className="text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              start from a blank canvas
            </a>
            .
          </p>
        ) : (
          <div className="mt-12 flex flex-col gap-10">
            {open.map((shelf) => (
              <TemplateCarousel
                key={`${shelf.id}-${mode}`}
                label={shelf.label}
                count={shelf.templates.length}
                itemsKey={shelf.templates.map((t) => t.kind).join(',')}
                reveal={opened || searching}
              >
                {shelf.templates.map((t, i) => {
                  const ModeIcon = EDITOR_MODE_ICONS[t.mode];
                  return (
                    <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                      <a
                        href={ctaHref(templateCreateHref(t.kind), 'Home.Gallery')}
                        aria-label={`Create a ${t.title}`}
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
        )}
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <Glyph
      size={18}
      units={24}
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 L16 16" />
    </Glyph>
  );
}
