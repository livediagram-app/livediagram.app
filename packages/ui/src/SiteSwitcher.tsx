'use client';

// The site switcher (liveworkspace/docs/site-switcher.md): hover the logo and a card lists
// liveworkspace.app, then each app, one click to any of them. It wraps whatever logo the header
// draws (the Brand, tinted or not), so the logo itself still links home.
//
// Opens three ways: hover on a pointer (CSS group-hover, the chevron fading in to say so), a tap on
// the chevron on touch (always shown there, since nothing hovers), and the chevron as a menu button
// from the keyboard (docs/specs/004-interface-design/menus.md). Links are plain <a> to each site's
// own origin: every site is a different one, at its home unless the header says where (`hrefFor`: the Explorer's
// header keeps the person on the Explorer, @liveworkspace/sites explorerSwitchHref). Each product binds it to its app (its SiteSwitcher), whose
// prism every row's mark is drawn in, tinted with that row's accent.

import { BrandMark, type BrandApp } from '@liveworkspace/brand';
import { APP_SITES, PLATFORM_SITE, type Site, type SiteId } from '@liveworkspace/sites';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { ChevronDownIcon } from './icons/navigation';
import { useMenu, useMenuButton } from './menu';
import { useClickOutside } from './useClickOutside';

// The open menu's name. Given to useMenu: an aria-label on the surface itself is overwritten by its trigger's name.
const MENU_LABEL = 'liveworkspace sites';

export function SiteSwitcher({
  app,
  current,
  hrefFor,
  children,
  className = '',
}: {
  // The app whose header this is.
  app: BrandApp;
  // The site this header belongs to, marked in the list.
  current: SiteId;
  // Where each site's row leads (its home when absent).
  hrefFor?: ((site: Site) => string) | null;
  // The logo.
  children: ReactNode;
  className?: string;
}) {
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({
    open,
    onClose: close,
    trigger,
    initialFocus,
    label: MENU_LABEL,
  });
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className={`group/sites relative flex items-center ${className}`}>
      {children}
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch site"
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={`relative ml-0.5 flex h-7 w-5 items-center justify-center touch-target-y rounded-md text-slate-400 outline-none transition-opacity duration-micro hover:text-slate-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500 group-hover/sites:opacity-100 pointer-coarse:opacity-100 dark:text-slate-400 dark:hover:text-slate-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ChevronDownIcon
          size={12}
          className={`h-3 w-3 transition-transform duration-micro group-hover/sites:[transform:rotate(180deg)] ${
            open ? '[transform:rotate(180deg)]' : ''
          }`}
        />
      </button>

      {/* pt-2 is a transparent bridge, so the pointer can travel from the logo to the card without
          crossing a gap that would close it. Below `sm` the card spans the screen between the 16px page gutters:
          it hangs from the logo, which sits on the left gutter, and is the screen less both gutters wide. Never
          `fixed`: a header with a backdrop blur is the box a fixed child is placed in, which put the card above
          the screen. */}
      <div
        className={`absolute left-0 top-full z-50 pt-2 transition-all duration-micro group-hover/sites:visible group-hover/sites:opacity-100 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          ref={attach}
          {...surfaceProps}
          className="w-72 max-sm:w-[calc(100vw-2rem)] outline-none rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          <SiteRow
            app={app}
            site={PLATFORM_SITE}
            href={hrefFor ? hrefFor(PLATFORM_SITE) : PLATFORM_SITE.url}
            current={current}
            onPick={close}
          />
          <div
            role="separator"
            className="mx-2 my-1 border-t border-slate-200 dark:border-slate-700"
          />
          {APP_SITES.map((site) => (
            <SiteRow
              key={site.id}
              app={app}
              site={site}
              href={hrefFor ? hrefFor(site) : site.url}
              current={current}
              onPick={close}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SiteRow({
  app,
  site,
  href,
  current,
  onPick,
}: {
  app: BrandApp;
  site: Site;
  href: string;
  current: SiteId;
  onPick: () => void;
}) {
  const isCurrent = site.id === current;
  return (
    <a
      href={href}
      role="menuitem"
      tabIndex={-1}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={onPick}
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2 transition ${
        isCurrent
          ? 'bg-slate-100 dark:bg-slate-700/60'
          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <BrandMark app={app} accentColor={site.accent} className="mt-0.5 size-5 shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5">
        {/* The wordmark, without ".app" (the row already links to the site): "live" in the site's
            colour, deep on light and its accent on dark, as each site's own header draws it. */}
        <span
          className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          style={{ '--site-ink': site.deep, '--site-ink-dark': site.accent } as CSSProperties}
        >
          <span className="text-[var(--site-ink)] dark:text-[var(--site-ink-dark)]">live</span>
          {site.name.replace(/^live/, '')}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{site.pitch}</span>
      </span>
    </a>
  );
}
