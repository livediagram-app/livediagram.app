// Help-centre breadcrumb bar. The trail itself — home-icon root, chevron
// separators, truncating labels — is BreadcrumbTrail in @livediagram/ui, shared
// with the marketing site so the two surfaces read consistently. This file owns
// what is specific to the help centre: a bar that sticks under the shared site
// header, next/link routing, and the BreadcrumbList structured data for the
// trail (built by the shared breadcrumbJsonLd, which marketing's
// BreadcrumbJsonLd uses too, rooted here at the help home).

import Link from 'next/link';
import { breadcrumbJsonLd, BreadcrumbTrail, JsonLd, type BreadcrumbItem } from '@livediagram/ui';
import { HELP_URL } from '@/lib/site';

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-slate-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 md:px-8">
        <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
          <BreadcrumbTrail items={items} rootLabel="Help" linkComponent={Link} />
        </nav>
      </div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Help', url: `${HELP_URL}/` },
          ...items.map((item) => ({
            name: item.label,
            url: item.href ? `${HELP_URL}${item.href}` : undefined,
          })),
        ])}
      />
    </div>
  );
}
