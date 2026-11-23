'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { ACCOUNT_PALETTE } from '@liveworkspace/account-menu/menu-parts';
import { lucideChevronDown } from '@liveworkspace/icons/lucide';
import { lucideGlyph, useMenuButton } from '@liveworkspace/ui';
import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import type { HeaderMenuSurfaceProps } from './HeaderMenuSurface';
import { headerMenuPages, isCurrent, type HeaderMenuName } from './header-menu-pages';

// The header's two menus (liveworkspace/docs/specs/010-site/site.md "The header"): Product and Support, each a menu
// button whose rows are an icon, a name and a hint, in the account menu's own look. Sign In or the account menu stays
// on the bar beside them, never inside one.
//
// Only the two buttons are here. The open menu (its rows, their icons and the menu's keys) is HeaderMenuSurface, a
// chunk of its own fetched as a pointer or focus reaches a button, so by the press it is in and the menu opens in
// the press's own commit: the header is on every page, and the rows on its first load took `/` past its budget
// (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").
const HeaderMenuSurface = lazyPanel<HeaderMenuSurfaceProps>('header-menu', () =>
  import('./HeaderMenuSurface').then((m) => m.HeaderMenuSurface),
);

/** Fetches the open menu's code ahead of time (a test warming its imports). */
export const preloadHeaderMenus = (): Promise<void> => HeaderMenuSurface.preload();

const prepare = () => void HeaderMenuSurface.preload();

const ChevronIcon = lucideGlyph(lucideChevronDown, 16);

const TRIGGER =
  'relative touch-target-y inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 aria-expanded:bg-slate-100 aria-expanded:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:aria-expanded:bg-slate-800 dark:aria-expanded:text-white';

function HeaderMenu({ menu }: { menu: HeaderMenuName }) {
  const path = usePathname();
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const here = headerMenuPages(menu).some((href) => isCurrent(href, path));
  return (
    <div ref={ref} className={`relative ${ACCOUNT_PALETTE}`} data-header-menu={menu}>
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        onPointerEnter={prepare}
        onPointerDown={prepare}
        onFocus={prepare}
        className={`${TRIGGER} ${here ? 'text-slate-900 dark:text-white' : ''}`}
      >
        {menu}
        <ChevronIcon
          aria-hidden
          className={`size-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <HeaderMenuSurface
          menu={menu}
          path={path}
          trigger={trigger}
          box={ref}
          initialFocus={initialFocus}
          close={close}
        />
      )}
    </div>
  );
}

/** Product and Support, side by side on the bar. Hidden below 768px, where the footer lists every link. */
export function HeaderMenus() {
  return (
    <div className="flex items-center gap-1 max-md:hidden">
      <HeaderMenu menu="Product" />
      <HeaderMenu menu="Support" />
    </div>
  );
}
