'use client';

import { useRef, useState } from 'react';
import { lucideSettings } from '@livediagram/icons/lucide';
import {
  infographicPageRect,
  PAGE_ORIENTATIONS,
  type PageOrientation,
} from '@livediagram/document';
import {
  CheckIcon,
  Glyph,
  lucideGlyph,
  Tooltip,
  useClickOutside,
  useEscape,
} from '@livediagram/ui';
import type { InfographicPageView } from '@/hooks/editor/useInfographicPage';

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

// Infographic mode's page (docs/specs/007-editor/editor-modes.md "The page"): a sheet of A4 paper,
// painted in canvas space under every element so it pans and zooms with them, on the tab's own
// canvas (colour and pattern), which stays the surround. Turning it eases between the two shapes
// about its centre. The sheet takes no pointer events: a press on it is a press on the canvas. Its
// name sits above its top-left corner and the page settings cog above its top-right, both held at
// one screen size at any zoom.
export function InfographicPage({ page, zoom }: { page: InfographicPageView; zoom: number }) {
  const rect = infographicPageRect(page.orientation);
  // Held at one screen size whatever the zoom, hanging from the page's top edge.
  const chrome = (origin: 'left' | 'right') => ({
    bottom: '100%',
    marginBottom: 8 / zoom,
    transform: `scale(${1 / zoom})`,
    transformOrigin: `bottom ${origin}`,
  });
  return (
    <div
      data-infographic-page={page.orientation}
      className="pointer-events-none absolute bg-white transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        boxShadow: '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
      }}
    >
      <span
        className="absolute left-0 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400"
        style={chrome('left')}
      >
        A4 · {ORIENTATION_LABEL[page.orientation]}
      </span>
      {page.setOrientation ? (
        <div className="absolute right-0" style={chrome('right')}>
          <PageSettings orientation={page.orientation} onOrientation={page.setOrientation} />
        </div>
      ) : null}
    </div>
  );
}

// The page's settings: a cog that opens a small menu below it, holding the orientation choice.
// Menu button pattern: the cog is `aria-haspopup="menu"`, the rows `menuitemradio`; Escape or an
// outside press closes it.
function PageSettings({
  orientation,
  onOrientation,
}: {
  orientation: PageOrientation;
  onOrientation: (next: PageOrientation) => void;
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
  return (
    <div
      ref={root}
      className="pointer-events-auto relative"
      // A press here is the menu's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Page settings">
        <button
          ref={cog}
          type="button"
          aria-label="Page settings"
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
          aria-label="Page settings"
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
              aria-checked={orientation === o}
              onClick={() => {
                onOrientation(o);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <OrientationGlyph orientation={o} />
              <span className="flex-1">{ORIENTATION_LABEL[o]}</span>
              {orientation === o ? <CheckIcon className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
