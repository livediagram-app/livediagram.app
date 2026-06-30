'use client';

// The wordmark subtitle ("Explorer" / "Help" next to the logo) turned into a
// quick-navigation dropdown shared by the Explorer (apps/live), Help
// (apps/help) and Telemetry headers. It reads as a plain label until hovered,
// when a chevron fades in and a menu drops down to jump between the product's
// main surfaces. Helps a visitor build a mental model of where things live.
//
// Opens two ways: hover/focus on desktop (CSS group-hover / focus-within) and
// an explicit tap toggle for touch, where neither hover nor :focus fires
// reliably on a <button> (iOS Safari). Links are plain <a> with absolute hrefs
// because the destinations live in different apps stitched under one host by
// the router, so client-side nav wouldn't cross them.

import { useEffect, useRef, useState, type ReactNode } from 'react';

type ProductNavKey = 'home' | 'explorer' | 'editor' | 'help' | 'telemetry';

// Per-surface glyphs (16px, 1.6 stroke) for the menu rows. The closed
// trigger deliberately keeps the hamburger instead of the current page's
// icon, so it always reads as "open the apps menu".
function NavSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}
// Functions, not pre-built elements: building JSX at module scope would
// run the JSX factory at import time (it throws under the classic-runtime
// transform some consumers' tests use). Called lazily during render.
const ICONS: Record<ProductNavKey, () => ReactNode> = {
  home: () => (
    <NavSvg>
      <path d="M2.5 7.5 8 3l5.5 4.5" />
      <path d="M4 7v6h8V7" />
    </NavSvg>
  ),
  editor: () => (
    <NavSvg>
      <path d="M10.5 2.5 13.5 5.5 6 13l-3.5.5L3 10z" />
      <path d="M9.5 3.5 12.5 6.5" />
    </NavSvg>
  ),
  explorer: () => (
    <NavSvg>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.2l1.3 1.5h5.5A1.5 1.5 0 0 1 14 6v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </NavSvg>
  ),
  help: () => (
    <NavSvg>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.2a1.8 1.8 0 0 1 3.4.6c0 1.2-1.7 1.5-1.7 2.7" />
      <path d="M8 11.6h.01" />
    </NavSvg>
  ),
  telemetry: () => (
    <NavSvg>
      <path d="M2 11l3-3 2.5 2L11 6l3 3" />
      <path d="M2 14h12" />
    </NavSvg>
  ),
};

const ITEMS: { key: ProductNavKey; label: string; href: string; desc: string }[] = [
  { key: 'home', label: 'Welcome', href: '/', desc: 'Learn about our features' },
  { key: 'editor', label: 'Editor', href: '/new', desc: 'Start or edit a diagram' },
  { key: 'explorer', label: 'Explorer', href: '/explorer/recent', desc: 'Your diagrams & folders' },
  { key: 'help', label: 'Help', href: '/help/', desc: 'Guides, tutorials & answers' },
  {
    key: 'telemetry',
    label: 'Telemetry',
    href: '/telemetry',
    desc: 'Anonymous usage, in the open',
  },
];

// `showOnMobile` opts a surface into rendering the menu on phones (next to the
// logo), where it otherwise hides to save room. The Explorer, Help, and
// Telemetry headers pass it; the space-tight editor toolbar leaves it off so
// the menu stays desktop-only there.
export function ProductNav({
  current,
  showOnMobile = false,
}: {
  current: ProductNavKey;
  showOnMobile?: boolean;
}) {
  const active = ITEMS.find((i) => i.key === current) ?? ITEMS[0]!;
  // Explicit open state for tap-to-toggle (touch). Desktop hover/focus still
  // opens via CSS regardless of this; this just adds a click path and the
  // outside-tap / Escape close that a pure-CSS menu can't do.
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // ml-* gives the menu breathing room from the logo it always sits beside,
  // in every header that renders it (marketing / telemetry / editor / explorer
  // / help) without each having to widen its own gap.
  return (
    <div
      ref={ref}
      className={`group relative ml-1.5 sm:ml-3 ${showOnMobile ? 'block' : 'hidden sm:block'}`}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Switch section, currently ${active.label}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:border-slate-300 focus-visible:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      >
        {/* Hamburger affordance so the label reads as an openable menu, not a
            static section name. */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden
          className="h-3.5 w-3.5"
        >
          <path d="M2.5 5h11M2.5 8h11M2.5 11h11" />
        </svg>
        {/* Hide the section label on phones (the hamburger + chevron still read
            as a menu, and the aria-label carries the current section) so the
            header's Brand + menu + "Start drawing" CTA stop crowding each other
            on a narrow screen. The label returns at sm+. */}
        <span className="hidden sm:inline">{active.label}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`h-3 w-3 opacity-60 transition-transform duration-200 group-hover:[transform:rotate(180deg)] group-focus-within:[transform:rotate(180deg)] ${
            open ? '[transform:rotate(180deg)]' : ''
          }`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* pt-2 is a transparent bridge so the pointer can travel from the label
          to the card without crossing a gap that would close the menu. The
          `open` state mirrors the CSS hover/focus visibility for touch taps. */}
      <div
        className={`absolute left-0 top-full z-50 pt-2 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          role="menu"
          className="w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          {ITEMS.map((item) => {
            const isCurrent = item.key === current;
            return (
              <a
                key={item.key}
                href={item.href}
                role="menuitem"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`group/navitem flex items-start gap-2.5 rounded-lg px-3 py-2 transition ${
                  isCurrent
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 ${
                    isCurrent
                      ? 'text-brand-600 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {ICONS[item.key]()}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={`text-sm font-semibold ${
                      isCurrent
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-slate-800 dark:text-slate-100 dark:group-hover/navitem:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { ProductNavKey };
