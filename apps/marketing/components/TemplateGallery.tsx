'use client';

import { TemplatePreview } from '@livediagram/template-previews';
import { ctaHref } from '@livediagram/api-schema';
import { templateCreateHref, type TemplateCategory } from '@livediagram/templates';
import { useState, type CSSProperties } from 'react';
import { TemplateCarousel } from '@/components/TemplateCarousel';
import { filterGallery, galleryTemplates, groupGallery } from '@/lib/template-gallery';

// "What do you want to create?" (spec/16): one card per template the editor
// ships, each category a four-across carousel (TemplateCarousel), with a
// search box that filters as you type. Only the first category opens on
// load; the rest sit folded in a cloud of category chips below it, so the
// band stays short until the visitor asks for more. A chip opens its
// category alongside whatever is already open (nothing else folds; an
// open category stays open for the visit), and a search shows every
// matching category regardless. Every card is a link that creates that diagram straight away
// and opens it in the editor (/new?template=<kind>, spec/14), so the
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
    <section className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">
            One canvas, many jobs
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What do you want to create?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Pick a starting point and you are on the canvas with it already drawn. Every template
            the editor ships is here.
          </p>
        </div>

        {/* The search box. Not the shared TextInput: that is drawn for a
            light form, and this sits on the page's one dark band. */}
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
              className="w-full rounded-xl border border-slate-700 bg-slate-800/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
            />
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="mt-12 text-center text-slate-400">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different word, or{' '}
            <a
              href={ctaHref('/new?blank=1', 'Home.GalleryDraw')}
              className="text-brand-400 underline-offset-2 hover:underline"
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
                itemsKey={group.templates.map((t) => t.kind).join(',')}
                reveal={group.id !== FIRST_CATEGORY}
              >
                {group.templates.map((t, i) => (
                  <li key={t.kind} style={{ '--tg-i': i } as CSSProperties}>
                    <a
                      href={ctaHref(templateCreateHref(t.kind), 'Home.Gallery')}
                      aria-label={`Create a ${t.title}`}
                      className="group flex h-full flex-col rounded-2xl border border-slate-700/80 bg-slate-800/40 p-3 transition hover:border-brand-400 hover:bg-slate-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    >
                      {/* The picker's preview, drawn for a light tile and
                          re-lit for this dark band by the same rule the
                          editor's dark chrome uses (preview-art-tile-dark),
                          scaled up from its fixed picker size. */}
                      <span className="preview-art-tile-dark flex h-24 items-center justify-center rounded-xl bg-slate-50 [&>svg]:h-16 [&>svg]:w-auto">
                        <TemplatePreview kind={t.kind} />
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-white">{t.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                        {t.description}
                      </span>
                    </a>
                  </li>
                ))}
              </TemplateCarousel>
            ))}
            {folded.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  More categories
                </h3>
                {/* The cloud: one chip per folded category, with how many
                    templates it holds. Clicking opens that category above. */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {folded.map((group) => (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() => openCategory(group.id)}
                        aria-label={`Show ${group.label} templates`}
                        className="rounded-full border border-slate-700 bg-slate-800/60 px-3.5 py-1.5 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                      >
                        {group.label}
                        <span className="ml-1.5 text-xs text-slate-400">
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
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 L16 16" />
    </svg>
  );
}
