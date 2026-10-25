'use client';

// A product's own surfaces (Home, Editor, Explorer, Community, Help, Telemetry), as a row of links for
// the Explorer's footer. The header's section menu that used to share these went in October 2026:
// headers now switch between liveworkspace's sites from the logo instead (SiteSwitcher,
// liveworkspace/docs/site-switcher.md). Links are plain <a> with absolute hrefs because the
// destinations live in different apps stitched under one host by the router. Community is livediagram's alone,
// which binds this to its Community's address while the Community is on (its ProductNav).

import type { ReactNode } from 'react';
import { Glyph } from './icons/Glyph';

type ProductNavKey = 'home' | 'explorer' | 'editor' | 'community' | 'help' | 'telemetry';

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
  // Two overlapping people: documents shared by others (livediagram's docs/specs/025-community/community.md).
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

const itemsOf = (
  community: string | undefined,
): { key: ProductNavKey; label: string; href: string }[] => [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'editor', label: 'Editor', href: '/new' },
  { key: 'explorer', label: 'Explorer', href: '/explorer' },
  ...(community ? [{ key: 'community' as const, label: 'Community', href: community }] : []),
  { key: 'help', label: 'Help', href: '/help/' },
  { key: 'telemetry', label: 'Telemetry', href: '/telemetry' },
];

// The same surfaces as a row of links, for a host that carries no menu (the editor's Explorer footer,
// docs/specs/013-workspace/explorer-structure.md "Layout"): each icon and label, `current` left out. `community`
// is the Community's address when the product has one and it is on. Telemetry is left out: the Explorer footer
// keeps to where someone works.
export function ProductNavLinks({
  current,
  community,
  className = '',
}: {
  current: ProductNavKey;
  community?: string;
  className?: string;
}) {
  const items = itemsOf(community).filter((i) => i.key !== current && i.key !== 'telemetry');
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
