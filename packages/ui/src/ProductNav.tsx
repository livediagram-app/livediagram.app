'use client';

// The wordmark subtitle ("Explorer" / "Help" next to the logo) turned into a
// quick-navigation dropdown shared by the Explorer (apps/live), Help
// (apps/help), Community (apps/community) and Telemetry headers. It reads as a plain label until hovered,
// when a chevron fades in and a menu drops down to jump between the product's
// main surfaces. Helps a visitor build a mental model of where things live.
//
// Opens two ways: hover/focus on desktop (CSS group-hover / focus-within) and
// an explicit tap toggle for touch, where neither hover nor :focus fires
// reliably on a <button> (iOS Safari). Links are plain <a> with absolute hrefs
// because the destinations live in different apps stitched under one host by
// the router, so client-side nav wouldn't cross them.

import { COMMUNITY_HOME_PATH } from '@livediagram/api-schema';
import { useRef, type ReactNode, useState } from 'react';
import { useCommunityEnabled } from './community/useCommunityEnabled';
import { useClickOutside } from './useClickOutside';
import { useMenu } from './menu/useMenu';
import { useMenuButton } from './menu/useMenuButton';
import { ChevronDownIcon } from './icons';
import { Glyph } from '@livediagram/ui';

type ProductNavKey = 'home' | 'explorer' | 'editor' | 'community' | 'help' | 'telemetry';

// Per-surface glyphs (16px, 1.6 stroke) for the menu rows. The closed
// trigger deliberately keeps the hamburger instead of the current page's
// icon, so it always reads as "open the apps menu".
function NavSvg({ children }: { children: ReactNode }) {
  return (
    <Glyph size={16} units={16} className="h-4 w-4">
      {children}
    </Glyph>
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
  // Two overlapping people: documents shared by others (docs/specs/025-community/community.md).
  community: () => (
    <NavSvg>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c.4-2.3 2-3.6 4-3.6s3.6 1.3 4 3.6" />
      <circle cx="11" cy="6" r="1.8" />
      <path d="M10.6 9.5c1.7.1 3 1.2 3.4 3.1" />
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
  { key: 'editor', label: 'Editor', href: '/new', desc: 'Start or edit a document' },
  { key: 'explorer', label: 'Explorer', href: '/explorer', desc: 'Your documents & folders' },
  {
    key: 'community',
    label: 'Community',
    href: COMMUNITY_HOME_PATH,
    desc: 'Work people are proud of',
  },
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
  // The Community entry goes while the Community is switched off (docs/specs/025-community/community.md "Turning
  // the Community off"). Asked once someone reaches for the menu (pointer, focus, or opening it), so a page view
  // that never touches it costs no request.
  const [reached, setReached] = useState(false);
  // Explicit open state: a click, Enter, Space or an arrow key opens it with focus inside and the
  // menu keyboard (docs/specs/004-interface-design/menus.md). Desktop hover still shows it through
  // CSS without taking focus; focusing the trigger alone no longer opens it (D56).
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const communityOn = useCommunityEnabled(undefined, reached || open);
  const items = communityOn ? ITEMS : ITEMS.filter((i) => i.key !== 'community');
  const active = items.find((i) => i.key === current) ?? items[0]!;
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({ open, onClose: close, trigger, initialFocus });

  useClickOutside(ref, close, open);

  // ml-* gives the menu breathing room from the logo it always sits beside,
  // in every header that renders it (marketing / telemetry / editor / explorer
  // / help) without each having to widen its own gap.
  return (
    <div
      ref={ref}
      onPointerEnter={() => setReached(true)}
      onFocus={() => setReached(true)}
      className={`group relative ml-1.5 sm:ml-3 ${showOnMobile ? 'block' : 'hidden sm:block'}`}
    >
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Switch section, currently ${active.label}`}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className="optical-edges flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:border-slate-300 focus-visible:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        {/* Hamburger affordance so the label reads as an openable menu, not a
            static section name. */}
        <Glyph size={14} units={16} className="h-3.5 w-3.5" strokeLinejoin="miter">
          <path d="M2.5 5h11M2.5 8h11M2.5 11h11" />
        </Glyph>
        {/* Hide the section label on phones (the hamburger + chevron still read
            as a menu, and the aria-label carries the current section) so the
            header's Brand + menu + "Start drawing" CTA stop crowding each other
            on a narrow screen. The label returns at sm+. */}
        {/* Trimmed to its cap band so it centres on the letters (optical-alignment.md); the button's
            height is pinned above because the trimmed label no longer props it open. */}
        <span className="text-optical-centre max-sm:hidden">{active.label}</span>
        <ChevronDownIcon
          size={12}
          className={`h-3 w-3 opacity-60 transition-transform duration-micro group-hover:[transform:rotate(180deg)] ${
            open ? '[transform:rotate(180deg)]' : ''
          }`}
        />
      </button>

      {/* pt-2 is a transparent bridge so the pointer can travel from the label
          to the card without crossing a gap that would close the menu. The
          `open` state mirrors the CSS hover/focus visibility for touch taps.
          Below `sm` the trigger sits ~150px in, so a trigger-anchored w-60 card
          ran past the right edge (cut off when open, and widening the page by a
          pixel even while hidden). There it pins to the 16px page gutters
          instead; `top-auto` keeps it at its static spot, straight under the
          trigger. */}
      <div
        className={`absolute left-0 top-full z-50 pt-2 max-sm:fixed max-sm:inset-x-4 max-sm:top-auto transition-all duration-micro group-hover:visible group-hover:opacity-100 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          ref={attach}
          {...surfaceProps}
          className="w-60 max-sm:w-auto outline-none rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          {items.map((item) => {
            const isCurrent = item.key === current;
            return (
              <a
                key={item.key}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={close}
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
