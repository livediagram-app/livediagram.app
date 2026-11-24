'use client';

// The site switcher (liveworkspace/docs/specs/010-site/site-switcher.md): hover the logo and a card lists
// liveworkspace.app, then each app, one click to any of them. It wraps whatever logo the header
// draws (the Brand, tinted or not), so the logo itself still links home.
//
// Opens three ways: hover on a pointer (CSS group-hover, the chevron fading in to say so), a tap on
// the logo or the chevron on touch (the chevron always shown there, since nothing hovers), and the
// chevron as a menu button from the keyboard (docs/specs/004-interface-design/menus.md). A tap on the
// logo (a touch press, told by its pointerdown, so an iPad's trackpad still clicks) opens the card instead
// of following it, and the current site's row then leads where the logo did, so home is two taps; a mouse click or Enter on the logo still follows it. Links are plain <a> to each site's
// own origin: every site is a different one, at its home unless the header says where (`hrefFor`: the Explorer's
// header keeps the person on the Explorer, @liveworkspace/sites explorerSwitchHref). Each product binds it to its app (its SiteSwitcher), whose
// prism every row's mark is drawn in, tinted with that row's accent.

import { BrandMark, type BrandApp } from '@liveworkspace/brand';
import {
  APP_SITES,
  PLATFORM_SITE,
  SITES,
  siteHrefFrom,
  type Site,
  type SiteId,
} from '@liveworkspace/sites';
import {
  memo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ChevronDownIcon } from './icons/navigation';
import { useMenu, useMenuButton } from './menu';
import { isTouchTap } from './touch-tap';
import { useClickOutside } from './useClickOutside';

const subscribeNever = () => () => {};
const pageHost = () => window.location.host;
const noHost = () => '';

// The open menu's name. Given to useMenu: an aria-label on the surface itself is overwritten by its trigger's name.
const MENU_LABEL = 'liveworkspace sites';
const LOGO_SLOT: CSSProperties = { display: 'contents' };

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
  const { open, openMenu, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  // Where the logo leads, kept once a tap on it opened the card: the current site's row goes there instead.
  const [logoHref, setLogoHref] = useState<string | null>(null);
  // The site the preview pane shows: the one pointed at or focused, else the current one.
  const [preview, setPreview] = useState<Site | null>(null);
  const shown = preview ?? SITES.find((site) => site.id === current) ?? PLATFORM_SITE;
  const ref = useRef<HTMLDivElement>(null);
  // The pointer that pressed the logo last, read at its click: iOS Safari's click from a tap can name a mouse.
  const pressedWith = useRef<string | null>(null);
  const { attach, surfaceProps } = useMenu({
    open,
    onClose: close,
    trigger,
    initialFocus,
    label: MENU_LABEL,
  });
  useClickOutside(ref, close, open);
  // The page's host, in the browser only: a staging page links each site's staging origin (siteHrefFrom). The server's
  // markup has none, since the static pages are built once for production and staging.
  const host = useSyncExternalStore(subscribeNever, pageHost, noHost);
  const hrefOf = (site: Site) =>
    site.id === current && logoHref !== null
      ? logoHref
      : siteHrefFrom(site, hrefFor ? hrefFor(site) : site.url, host);
  // Captured before the logo's own handlers, so a framework link never starts its navigation. With the card open
  // the tap is left alone and follows the logo.
  const onLogoPointerDown = (e: PointerEvent<HTMLElement>) => {
    pressedWith.current = e.pointerType;
  };
  const onLogoClick = (e: MouseEvent<HTMLElement>) => {
    const pointer = pressedWith.current;
    pressedWith.current = null;
    if (open || !isTouchTap(e.nativeEvent, pointer)) return;
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!link || !e.currentTarget.contains(link)) return;
    e.preventDefault();
    e.stopPropagation();
    setLogoHref(link.getAttribute('href'));
    openMenu('checked');
  };

  return (
    <div
      ref={ref}
      onPointerEnter={() => setPreview(null)}
      className={`group/sites relative flex items-center ${className}`}
    >
      {/* No box of its own (an inline style, so no app's stylesheet has to generate it): the logo stays the flex item. */}
      <span style={LOGO_SLOT} onPointerDownCapture={onLogoPointerDown} onClickCapture={onLogoClick}>
        {children}
      </span>
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
        onPointerLeave={() => setPreview(null)}
        className={`absolute left-0 top-full z-50 pt-2 transition-all duration-micro group-hover/sites:visible group-hover/sites:opacity-100 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        {/* The list, then the preview pane on the right; on a phone the pane is a strip above the list, which
            is two columns of tap targets (the spec's "The card"). */}
        <div
          ref={attach}
          {...surfaceProps}
          className="grid w-[29rem] max-sm:w-[calc(100vw-2rem)] overflow-hidden outline-none rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 sm:grid-cols-[12.5rem_minmax(0,1fr)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          <SitePreview
            app={app}
            site={shown}
            href={hrefOf(shown)}
            isCurrent={shown.id === current}
            onPick={close}
          />
          <AccountStrip
            app={app}
            href={hrefOf(PLATFORM_SITE)}
            isCurrent={current === PLATFORM_SITE.id}
            onPick={close}
          />
          <div className="grid content-start gap-px p-1.5 min-[360px]:max-sm:grid-cols-2 sm:order-first sm:border-r sm:border-slate-200 sm:dark:border-slate-700">
            {APP_SITES.map((site) => (
              <SiteRow
                key={site.id}
                app={app}
                site={site}
                href={hrefOf(site)}
                current={current}
                onPick={close}
                onShow={setPreview}
              />
            ))}
            <div
              role="separator"
              className="mx-2 my-1 border-t border-slate-200 max-sm:hidden dark:border-slate-700"
            />
            <SiteRow
              app={app}
              site={PLATFORM_SITE}
              href={hrefOf(PLATFORM_SITE)}
              current={current}
              onPick={close}
              onShow={setPreview}
              phoneHidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// "live" in the site's colour, deep on light and its accent on dark, as each site's own header draws it; the name
// without ".app" (the row already links to the site).
function Wordmark({ site, className }: { site: Site; className: string }) {
  return (
    <span
      className={`${className} truncate text-slate-800 dark:text-slate-100`}
      style={{ '--site-ink': site.deep, '--site-ink-dark': site.accent } as CSSProperties}
    >
      <span className="text-[var(--site-ink)] dark:text-[var(--site-ink-dark)]">live</span>
      {site.name.replace(/^live/, '')}
    </span>
  );
}

// The site pointed at (the current one until then): large, tinted, with its pitch. Not on a phone, where nothing
// points, so nothing would change it. A link to where its row goes,
// kept out of the menu's items, the tab order and the accessibility tree, since the row already is that link.
function SitePreview({
  app,
  site,
  href,
  isCurrent,
  onPick,
}: {
  app: BrandApp;
  site: Site;
  href: string;
  isCurrent: boolean;
  onPick: () => void;
}) {
  return (
    <a
      href={href}
      tabIndex={-1}
      aria-hidden="true"
      onClick={onPick}
      data-site-preview={site.id}
      className="flex min-w-0 flex-col items-start justify-center gap-2 p-5 transition-[background] duration-micro max-sm:hidden"
      style={{
        background: `radial-gradient(120% 90% at 30% 0%, color-mix(in srgb, ${site.accent} 20%, transparent), transparent 70%)`,
      }}
    >
      <BrandMark app={app} accentColor={site.accent} className="size-14 shrink-0" />
      <span className="flex min-w-0 flex-col gap-1">
        <Wordmark site={site} className="text-xl font-semibold tracking-tight" />
        <span className="min-h-[2.6em] text-[13px] leading-snug text-slate-500 dark:text-slate-400">
          {site.pitch}
        </span>
      </span>
      <span
        className="mt-1 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
        style={{ background: site.deep }}
      >
        {isCurrent ? 'You’re here' : `Open ${site.name}`}
      </span>
    </a>
  );
}

// On a phone, the account across the top of the card, tinted, with its pitch: the card's one wide target for
// liveworkspace. Its list row stays for a screen reader, which this strip is hidden from.
const AccountStrip = memo(function AccountStrip({
  app,
  href,
  isCurrent,
  onPick,
}: {
  app: BrandApp;
  href: string;
  isCurrent: boolean;
  onPick: () => void;
}) {
  return (
    <a
      href={href}
      tabIndex={-1}
      aria-hidden="true"
      onClick={onPick}
      data-account-strip
      className="flex min-w-0 items-center gap-3 border-b border-slate-200 px-4 py-3 sm:hidden dark:border-slate-700"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${PLATFORM_SITE.accent} 22%, transparent), transparent 75%)`,
      }}
    >
      <BrandMark app={app} accentColor={PLATFORM_SITE.accent} className="size-8 shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <Wordmark site={PLATFORM_SITE} className="text-sm font-semibold" />
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">
          {PLATFORM_SITE.pitch}
        </span>
      </span>
      {isCurrent ? (
        <span className="ml-auto shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          here
        </span>
      ) : null}
    </a>
  );
});

const SiteRow = memo(function SiteRow({
  app,
  site,
  href,
  current,
  onPick,
  onShow,
  phoneHidden = false,
}: {
  app: BrandApp;
  site: Site;
  href: string;
  current: SiteId;
  onPick: () => void;
  onShow: (site: Site) => void;
  // Seen only above `sm` (a phone shows the AccountStrip instead); a screen reader still has it.
  phoneHidden?: boolean;
}) {
  const isCurrent = site.id === current;
  return (
    <a
      href={href}
      role="menuitem"
      tabIndex={-1}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={onPick}
      onPointerEnter={() => onShow(site)}
      onFocus={() => onShow(site)}
      className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 transition max-sm:min-h-11 ${
        phoneHidden ? 'max-sm:sr-only' : ''
      } ${
        isCurrent
          ? 'bg-slate-100 dark:bg-slate-700/60'
          : 'hover:bg-slate-100 focus:bg-slate-100 dark:hover:bg-slate-700 dark:focus:bg-slate-700'
      }`}
    >
      <BrandMark app={app} accentColor={site.accent} className="size-[18px] shrink-0" />
      <Wordmark site={site} className="min-w-0 text-sm font-semibold" />
      {/* The pitch, for a screen reader: the row shows the name alone and the preview pane is hidden from it. */}
      <span className="sr-only">, {site.pitch}</span>
      {isCurrent ? (
        <span
          aria-hidden="true"
          className="ml-auto shrink-0 text-[11px] font-medium text-slate-500 max-sm:hidden dark:text-slate-400"
        >
          here
        </span>
      ) : null}
    </a>
  );
});
