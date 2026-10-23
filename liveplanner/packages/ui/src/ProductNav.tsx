'use client';

// A product's own surfaces (Home, Editor, Explorer, Help, Telemetry), as a row of links for the
// Explorer's footer. The header's section menu that used to share these went in October 2026:
// headers now switch between liveworkspace's sites from the logo instead (SiteSwitcher,
// liveworkspace/docs/site-switcher.md). Links are plain <a> with absolute hrefs because the
// destinations live in different apps stitched under one host by the router.

import type { ReactNode } from 'react';
import { Glyph } from '@liveplanner/ui';

type ProductNavKey = 'home' | 'explorer' | 'editor' | 'help' | 'telemetry';

// Per-surface glyphs (16px, 1.6 stroke) for the links.
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
  { key: 'home', label: 'Home', href: '/', desc: 'Learn about our features' },
  { key: 'editor', label: 'Editor', href: '/new', desc: 'Start or edit a plan' },
  { key: 'explorer', label: 'Explorer', href: '/explorer', desc: 'Your plans & folders' },
  { key: 'help', label: 'Help', href: '/help/', desc: 'Guides, tutorials & answers' },
  {
    key: 'telemetry',
    label: 'Telemetry',
    href: '/telemetry',
    desc: 'Anonymous usage, in the open',
  },
];

// The same surfaces as a row of links, for a host that carries no menu (the editor's Explorer footer,
// docs/specs/013-workspace/explorer-structure.md "Layout"): each icon and label, `current` left out. Telemetry is left
// out: the Explorer footer keeps to where someone works.
export function ProductNavLinks({
  current,
  className = '',
}: {
  current: ProductNavKey;
  className?: string;
}) {
  const items = ITEMS.filter((i) => i.key !== current && i.key !== 'telemetry');
  return (
    <nav aria-label="Go to" className={`flex items-center gap-0.5 ${className}`}>
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 pointer-coarse:h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {/* Below 360px (an iPhone SE) the four links fit only as words: with their icons Help ran off the edge. */}
          <span aria-hidden className="flex opacity-80 max-[359px]:hidden">
            {ICONS[item.key]()}
          </span>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export type { ProductNavKey };
