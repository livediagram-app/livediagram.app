'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import {
  ACCOUNT_PALETTE,
  ITEM,
  ItemBody,
  type IconComponent,
} from '@liveworkspace/account-menu/menu-parts';
import {
  lucideChartLine,
  lucideChevronDown,
  lucideCircleHelp,
  lucideColumns2,
  lucideHeartPulse,
  lucideLayoutGrid,
  lucideTag,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { lucideGlyph, useClickOutside, useMenu, useMenuButton } from '@liveworkspace/ui';

// The header's two menus (liveworkspace/docs/specs/010-site/site.md "The header"): Product and Support, each a menu
// button whose rows are an icon, a name and a hint, in the account menu's own look. Sign In or the account menu stays
// on the bar beside them, never inside one.

type Row = { href: string; label: string; hint: string; icon: IconComponent };

const ChevronIcon = lucideGlyph(lucideChevronDown, 16);

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

const TRIGGER =
  'relative touch-target-y inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 aria-expanded:bg-slate-100 aria-expanded:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:aria-expanded:bg-slate-800 dark:aria-expanded:text-white';

// The page a row is for: the same path (`/#apps` is the home page's section, never "current").
const isCurrent = (href: string, path: string | null): boolean =>
  !href.includes('#') && path !== null && (path === href || path.startsWith(`${href}/`));

function HeaderMenu({ label, rows }: { label: string; rows: Row[] }) {
  const path = usePathname();
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({ open, onClose: close, trigger, initialFocus, label });
  useClickOutside(ref, close, open);
  const here = rows.some((row) => isCurrent(row.href, path));
  return (
    <div ref={ref} className={`relative ${ACCOUNT_PALETTE}`} data-header-menu={label}>
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={`${TRIGGER} ${here ? 'text-slate-900 dark:text-white' : ''}`}
      >
        {label}
        <ChevronIcon
          aria-hidden
          className={`size-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none dark:text-slate-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
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
      )}
    </div>
  );
}

/** Product and Support, side by side on the bar. Hidden below 768px, where the footer lists every link. */
export function HeaderMenus() {
  return (
    <div className="flex items-center gap-1 max-md:hidden">
      <HeaderMenu label="Product" rows={productRows()} />
      <HeaderMenu label="Support" rows={SUPPORT_ROWS} />
    </div>
  );
}
