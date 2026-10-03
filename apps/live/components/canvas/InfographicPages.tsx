'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import { lucideSettings } from '@livediagram/icons/lucide';
import { INFOGRAPHIC_PAGE_GAP, pageLabel } from '@livediagram/document';
import { lucideGlyph, PlusIcon, Tooltip } from '@livediagram/ui';
import type { InfographicPagesView } from '@/hooks/editor/useInfographicPage';
import { pageSheetStyle, withBackgroundPatch } from '@/lib/infographic-page-paint';
import { InfographicPagePanel, PAGE_EASE_MS, type PagePreview } from './InfographicPagePanel';

const CogIcon = lucideGlyph(lucideSettings, 16);

// Screen px: the cog's width plus a gap, and the narrowest a label is still worth showing.
const COG_ROOM = 36;
const LABEL_MIN = 40;

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

// Infographic mode's pages (docs/specs/007-editor/infographic-pages.md): sheets in a row, painted
// in canvas space under every element so they pan and zoom with them, on the tab's own canvas,
// which stays the surround. Each sheet wears its own background (a hover in its panel previews
// one). A change of size, turn or removal eases the sheets to their new places. The sheets take no
// pointer events: a press on one is a press on the canvas. Each page's label sits above its
// top-left corner (a press frames the page) and its settings cog above its top-right; the
// add-a-page button follows the last page; all held at one screen size.
export function InfographicPages({ view, zoom }: { view: InfographicPagesView; zoom: number }) {
  const { pages, edit, focusPage } = view;
  // The open panel's page and the cog it hangs from.
  const [opened, setOpened] = useState<{ id: string; cog: HTMLButtonElement } | null>(null);
  const [preview, setPreview] = useState<PagePreview>(null);
  const last = pages[pages.length - 1]!;
  const openId = opened?.id ?? null;
  const open = edit && opened ? pages.find((p) => p.id === opened.id) : undefined;
  const close = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus) opened?.cog.focus();
      setOpened(null);
    },
    [opened],
  );
  const toggle = (id: string, cog: HTMLButtonElement) =>
    setOpened((o) => (o?.id === id ? null : { id, cog }));
  return (
    <>
      {pages.map((page) => {
        const background =
          preview?.pageId === page.id ? withBackgroundPatch(page, preview.patch) : page.background;
        const label = pageLabel(page, page.index, pages.length);
        // The label fits the page's on-screen width, less the cog's room; too narrow, it hides.
        const labelRoom = page.rect.width * zoom - (edit ? COG_ROOM : 0);
        return (
          <div
            key={page.id}
            data-infographic-page={page.orientation}
            className={`pointer-events-none absolute transition-[left,top,width,height] ease-out motion-reduce:transition-none ${
              background?.fill
                ? ''
                : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
            }`}
            style={{
              left: page.rect.x,
              top: page.rect.y,
              width: page.rect.width,
              height: page.rect.height,
              transitionDuration: `${PAGE_EASE_MS}ms`,
              boxShadow: '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
              ...pageSheetStyle(background),
            }}
          >
            <div
              className={`absolute left-0 flex items-center ${labelRoom < LABEL_MIN ? 'hidden' : ''}`}
              style={{
                bottom: '100%',
                marginBottom: 6 / zoom,
                maxWidth: labelRoom,
                ...steady(zoom, 'bottom left'),
              }}
            >
              <Tooltip label="Fit page to screen">
                <button
                  type="button"
                  aria-label={`${label}, fit to screen`}
                  onClick={() => focusPage(page.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto block max-w-full truncate whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-white/80 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
                >
                  {label}
                </button>
              </Tooltip>
            </div>
            {edit ? (
              <div
                className="absolute right-0"
                style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
              >
                <PageCog
                  name={`${page.name ?? (pages.length > 1 ? `Page ${page.index + 1}` : 'Page')} settings`}
                  open={openId === page.id}
                  onToggle={(cog) => toggle(page.id, cog)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {edit?.addPage ? (
        <AddPageButton
          // Centred in a gap's width to the right of the last page, on the row's axis.
          x={last.rect.x + last.rect.width + INFOGRAPHIC_PAGE_GAP / 2}
          zoom={zoom}
          onAdd={edit.addPage}
        />
      ) : null}
      {open && opened && edit ? (
        <InfographicPagePanel
          page={open}
          count={pages.length}
          anchor={opened.cog}
          edit={edit}
          onPreview={setPreview}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function AddPageButton({ x, zoom, onAdd }: { x: number; zoom: number; onAdd: () => void }) {
  return (
    <div
      className="pointer-events-auto absolute transition-[left] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: x, top: 0, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Add page">
        <button
          type="button"
          aria-label="Add page"
          onClick={onAdd}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <PlusIcon />
        </button>
      </Tooltip>
    </div>
  );
}

// The cog that opens the page's panel (InfographicPagePanel).
function PageCog({
  name,
  open,
  onToggle,
}: {
  name: string;
  open: boolean;
  onToggle: (cog: HTMLButtonElement) => void;
}) {
  return (
    <div
      className="pointer-events-auto"
      // A press here is the cog's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={name}>
        <button
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-page-panel-trigger
          onClick={(e) => onToggle(e.currentTarget)}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            open ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : ''
          }`}
        >
          <CogIcon />
        </button>
      </Tooltip>
    </div>
  );
}
