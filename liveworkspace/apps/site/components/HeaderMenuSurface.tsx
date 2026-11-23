'use client';

import type { RefObject } from 'react';
import { ITEM, ItemBody, type IconComponent } from '@liveworkspace/account-menu/menu-parts';
import {
  lucideChartLine,
  lucideCircleHelp,
  lucideColumns2,
  lucideHeartPulse,
  lucideLayoutGrid,
  lucideTag,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { lucideGlyph, useClickOutside, useMenu, type MenuButton } from '@liveworkspace/ui';
import { isCurrent, type HeaderMenuName } from './header-menu-pages';

// A header menu, open (liveworkspace/docs/specs/010-site/site.md "The header"): its rows, each an icon, a name and a
// hint in the account menu's own look, the keys that move through them and the press outside that closes it. Its
// own chunk, fetched as a pointer or focus reaches a menu button (HeaderMenus): the header is on every page, and a
// page that opens no menu carries none of this.

type Row = { href: string; label: string; hint: string; icon: IconComponent };

// Read as the menu is drawn: Pricing is there only where Pro is on in the build (019-subscription "The flag").
const productRows = (): Row[] => [
  {
    href: '/#apps',
    label: 'Our Apps',
    hint: 'Every app, free to use',
    icon: lucideGlyph(lucideLayoutGrid, 16),
  },
  ...(proOn()
    ? [
        {
          href: '/pricing',
          label: 'Pricing',
          hint: 'Free, Pro and Pro for Teams',
          icon: lucideGlyph(lucideTag, 16),
        },
      ]
    : []),
  {
    href: '/compare',
    label: 'Comparison',
    hint: 'How we compare with others',
    icon: lucideGlyph(lucideColumns2, 16),
  },
  {
    href: '/community',
    label: 'Community',
    hint: 'What people make and share',
    icon: lucideGlyph(lucideUsers, 16),
  },
];

const SUPPORT_ROWS: Row[] = [
  {
    href: '/help',
    label: 'Help',
    hint: 'Guides for every app',
    icon: lucideGlyph(lucideCircleHelp, 16),
  },
  {
    href: '/status',
    label: 'Status',
    hint: 'Whether everything is up',
    icon: lucideGlyph(lucideHeartPulse, 16),
  },
  {
    href: '/telemetry',
    label: 'Telemetry',
    hint: 'What we count, and why',
    icon: lucideGlyph(lucideChartLine, 16),
  },
];

export type HeaderMenuSurfaceProps = {
  menu: HeaderMenuName;
  /** The page being read, for the row that is current. */
  path: string | null;
  /** The menu's button and the box around it and this surface: a press outside the box closes the menu. */
  trigger: HTMLElement | null;
  box: RefObject<HTMLDivElement | null>;
  initialFocus: MenuButton['initialFocus'];
  close: () => void;
};

/** Drawn only while its menu is open. */
export function HeaderMenuSurface({
  menu,
  path,
  trigger,
  box,
  initialFocus,
  close,
}: HeaderMenuSurfaceProps) {
  const { attach, surfaceProps } = useMenu({ onClose: close, trigger, initialFocus, label: menu });
  useClickOutside(box, close);
  const rows = menu === 'Product' ? productRows() : SUPPORT_ROWS;
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute top-full left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] animate-fade-in rounded-xl border border-(--account-line) bg-(--account-surface) p-1.5 shadow-lg shadow-slate-900/10 motion-reduce:animate-none"
    >
      {rows.map((row) => (
        <a
          key={row.href}
          href={row.href}
          role="menuitem"
          tabIndex={-1}
          aria-current={isCurrent(row.href, path) ? 'page' : undefined}
          onClick={close}
          className={`${ITEM} aria-[current=page]:bg-(--account-hover)`}
        >
          <ItemBody icon={row.icon} label={row.label} hint={row.hint} />
        </a>
      ))}
    </div>
  );
}
