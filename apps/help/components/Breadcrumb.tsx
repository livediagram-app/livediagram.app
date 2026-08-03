// Help-centre breadcrumb bar. The trail itself — home-icon root, chevron
// separators, truncating labels — is BreadcrumbTrail in @livediagram/ui, shared
// with the marketing site so the two surfaces read consistently. This file owns
// what is specific to the help centre: a bar that sticks under the 64px site
// header, next/link routing, and the BreadcrumbList structured data, which the
// marketing side emits separately instead.

import Link from 'next/link';
import { BreadcrumbTrail, type BreadcrumbItem } from '@livediagram/ui';
import { HELP_URL } from '@/lib/site';

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="sticky top-16 z-40 border-b border-slate-200 bg-slate-50/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 md:px-8">
        <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
          <BreadcrumbTrail items={items} rootLabel="Help" linkComponent={Link} />
        </nav>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Help',
                item: `${HELP_URL}/`,
              },
              ...items.map((item, i) => ({
                '@type': 'ListItem',
                position: i + 2,
                name: item.label,
                ...(item.href ? { item: `${HELP_URL}${item.href}` } : {}),
              })),
            ],
          }),
        }}
      />
    </div>
  );
}
