'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { lucideSettings } from '@livediagram/icons/lucide';
import {
  INFOGRAPHIC_PAGE_GAP,
  PAGE_ORIENTATIONS,
  type LaidOutPage,
  type PageOrientation,
} from '@livediagram/document';
import {
  CheckIcon,
  Glyph,
  lucideGlyph,
  PlusIcon,
  Tooltip,
  TrashIcon,
  useClickOutside,
  useEscape,
} from '@livediagram/ui';
import type { InfographicPageEdits, InfographicPagesView } from '@/hooks/editor/useInfographicPage';

const ORIENTATION_LABEL = { portrait: 'Portrait', landscape: 'Landscape' } as const;

const CogIcon = lucideGlyph(lucideSettings, 16);

// A sheet standing tall or lying wide, for the orientation rows.
function OrientationGlyph({ orientation }: { orientation: PageOrientation }) {
  const portrait = orientation === 'portrait';
  return (
    <Glyph size={16} units={16}>
      <rect
        x={portrait ? 4 : 1.5}
        y={portrait ? 1.5 : 4}
        width={portrait ? 8 : 13}
        height={portrait ? 13 : 8}
        rx={1.2}
      />
    </Glyph>
  );
}

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

// Infographic mode's pages (docs/specs/007-editor/editor-modes.md "The pages"): sheets of A4 paper
// in a row, painted in canvas space under every element so they pan and zoom with them, on the
// tab's own canvas (colour and pattern), which stays the surround. A turn or a removal eases the
// sheets to their new places. The sheets take no pointer events: a press on one is a press on the
// canvas. Each page's name sits above its top-left corner and its settings cog above its
// top-right; the add-a-page button follows the last page; all held at one screen size.
export function InfographicPages({ view, zoom }: { view: InfographicPagesView; zoom: number }) {
  const { pages, edit } = view;
  const last = pages[pages.length - 1]!;
  const numbered = pages.length > 1;
  return (
    <>
      {pages.map((page) => (
        <div
          key={page.id}
          data-infographic-page={page.orientation}
          className="pointer-events-none absolute bg-white transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900"
          style={{
            left: page.rect.x,
            top: page.rect.y,
            width: page.rect.width,
            height: page.rect.height,
            boxShadow: '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
          }}
        >
          <span
            className="absolute left-0 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400"
            style={{ bottom: '100%', marginBottom: 8 / zoom, ...steady(zoom, 'bottom left') }}
          >
            {numbered ? `Page ${page.index + 1} · ` : ''}A4 · {ORIENTATION_LABEL[page.orientation]}
          </span>
          {edit ? (
            <div
              className="absolute right-0"
              style={{ bottom: '100%', marginBottom: 8 / zoom, ...steady(zoom, 'bottom right') }}
            >
              <PageSettings page={page} numbered={numbered} edit={edit} />
            </div>
          ) : null}
        </div>
      ))}
      {edit?.addPage ? (
        <AddPageButton
          // Centred in a gap's width to the right of the last page, on the row's axis.
          x={last.rect.x + last.rect.width + INFOGRAPHIC_PAGE_GAP / 2}
          zoom={zoom}
          onAdd={edit.addPage}
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

// A page's settings: a cog that opens a small menu below it, holding the page's orientation and,
// while there is more than one page, its removal. Menu button pattern: the cog is
// `aria-haspopup="menu"`, the rows menu items; Escape or an outside press closes it.
function PageSettings({
  page,
  numbered,
  edit,
}: {
  page: LaidOutPage;
  numbered: boolean;
  edit: InfographicPageEdits;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cog = useRef<HTMLButtonElement>(null);
  useClickOutside(root, () => setOpen(false), open);
  useEscape(
    () => {
      setOpen(false);
      cog.current?.focus();
    },
    { enabled: open, capture: true, stopPropagation: true },
  );
  const name = numbered ? `Page ${page.index + 1} settings` : 'Page settings';
  return (
    <div
      ref={root}
      className="pointer-events-auto relative"
      // A press here is the menu's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={name}>
        <button
          ref={cog}
          type="button"
          aria-label={name}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            open ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : ''
          }`}
        >
          <CogIcon />
        </button>
      </Tooltip>
      {open ? (
        <div
          role="menu"
          aria-label={name}
          className="absolute right-0 top-full z-10 mt-1.5 w-44 rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        >
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Orientation
          </div>
          {PAGE_ORIENTATIONS.map((o) => (
            <button
              key={o}
              type="button"
              role="menuitemradio"
              aria-checked={page.orientation === o}
              onClick={() => {
                edit.setOrientation(page.id, o);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <OrientationGlyph orientation={o} />
              <span className="flex-1">{ORIENTATION_LABEL[o]}</span>
              {page.orientation === o ? <CheckIcon className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
          {edit.removePage ? (
            <>
              <div role="separator" className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  edit.removePage?.(page.id);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="flex-1">Delete Page</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
