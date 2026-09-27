'use client';

import { TemplatePreview } from '@livediagram/template-previews';
import { ctaHref } from '@livediagram/api-schema';
import { templateCreateHref, type TemplateCategory } from '@livediagram/templates';
import { useState, type CSSProperties } from 'react';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { filterGallery, galleryTemplates, groupGallery } from '@/lib/template-gallery';
import {
  BAND_CARD,
  BAND_CONTROL_HOVER,
  BAND_EYEBROW,
  BAND_LABEL,
  BAND_LEAD,
  BAND_SECTION,
  BAND_TITLE,
} from '@/components/band-classes';
import { Glyph } from '@livediagram/ui';

// "What do you want to create?" (docs/specs/019-marketing/marketing-site.md): one card per template the editor
// ships, each category a four-across carousel (TemplateCarousel), with a
// search box that filters as you type. Only the first category opens on
// load; the rest sit folded in a cloud of category chips below it, so the
// band stays short until the visitor asks for more. A chip opens its
// category alongside whatever is already open (nothing else folds; an
// open category stays open for the visit), and a search shows every
// matching category regardless. Every card is a link that creates that diagram straight away
// and opens it in the editor (/new?template=<kind>, docs/specs/007-editor/new-diagram-route.md), so the
// landing page is one click from a drawn scaffold. The cards' artwork is
// the editor picker's own preview (@livediagram/template-previews), so a
// template looks the same here as it does in the app. Replaced the
// use-case carousel, whose seventeen illustrative cards linked nowhere.

const ALL = galleryTemplates();
const FIRST_CATEGORY = groupGallery(ALL)[0]?.id;

export function TemplateGallery() {
  const [query, setQuery] = useState('');
  // The open categories in the order they were opened: a newly opened one
  // always lands at the bottom, right above the cloud it came from, rather
  // than slotting into catalogue order somewhere the visitor isn't looking.
  const [openIds, setOpenIds] = useState<readonly TemplateCategory[]>(() =>
    FIRST_CATEGORY ? [FIRST_CATEGORY] : [],
  );
  const searching = query.trim() !== '';
  const groups = groupGallery(filterGallery(ALL, query));
  const open = searching ? groups : openIds.flatMap((id) => groups.filter((g) => g.id === id));
  const folded = searching ? [] : groups.filter((g) => !openIds.includes(g.id));
  const openCategory = (id: TemplateCategory) =>
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

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

        {/* The search box. Not the shared TextInput: this one is the band's
            larger, rounder search field. */}
        <div className="mx-auto mt-10 max-w-md">
          <label htmlFor="template-gallery-search" className="sr-only">
            Search templates
          </label>
          <div className="relative">
            <SearchIcon />
            <input
              id="template-gallery-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates, e.g. flowchart, retro, wireframe"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="mt-12 text-center text-slate-600 dark:text-slate-400">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different word, or{' '}
            <a
              href={ctaHref('/new?blank=1', 'Home.GalleryDraw')}
              className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
            >
              start from a blank canvas
            </a>
            .
          </p>
        ) : (
          <div className="mt-12 flex flex-col gap-10">
            {open.map((group) => (
              <TemplateCarousel
                key={group.id}
                label={group.label}
                count={group.templates.length}
                itemsKey={group.templates.map((t) => t.kind).join(',')}
                reveal={group.id !== FIRST_CATEGORY}
              >
                {group.templates.map((t, i) => (
                  <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                    <a
                      href={ctaHref(templateCreateHref(t.kind), 'Home.Gallery')}
                      aria-label={`Create a ${t.title}`}
                      className={`preview-motion-host group flex h-full flex-col p-3 ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
                    >
                      {/* The picker's preview, drawn for a light tile and
                          re-lit onto the dark canvas colour in dark by the
                          editor's own rule (preview-art-tile), scaled up
                          from its fixed picker size. */}
                      <span className="preview-art-tile preview-motion flex h-24 items-center justify-center rounded-xl bg-slate-50 [&>svg]:h-16 [&>svg]:w-auto">
                        <TemplatePreview kind={t.kind} />
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {t.description}
                      </span>
                    </a>
                  </li>
                ))}
              </TemplateCarousel>
            ))}
            {folded.length > 0 ? (
              <div>
                <h3 className={BAND_LABEL}>More categories</h3>
                {/* The cloud: one chip per folded category, with how many
                    templates it holds. Clicking opens that category above. */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {folded.map((group) => (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() => openCategory(group.id)}
                        aria-label={`Show ${group.label} templates`}
                        className={`rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white ${BAND_CONTROL_HOVER}`}
                      >
                        {group.label}
                        <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {group.templates.length}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
