// Help-centre breadcrumb bar. The trail itself (home-icon root, chevron separators, truncating labels) is
// BreadcrumbTrail in @liveworkspace/ui, shared with the marketing sites so the two surfaces read alike. This
// file owns what is specific to the help centre: a bar that sticks under the site header, next/link routing,
// and the BreadcrumbList structured data for the trail, rooted at the help home.
//
// Neither a server nor a client component of its own: the server pages render it, and so does the article
// shell in the browser, so the help centre's address comes in as a prop (HelpFacts.helpUrl).

import Link from 'next/link';
import { breadcrumbJsonLd, BreadcrumbTrail, JsonLd, type BreadcrumbItem } from '@liveworkspace/ui';

export function Breadcrumb({ items, helpUrl }: { items: BreadcrumbItem[]; helpUrl: string }) {
  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-slate-50/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 md:px-8">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <BreadcrumbTrail items={items} rootLabel="Help" linkComponent={Link} />
        </nav>
      </div>
      {/* None on the help home itself: a list of the home alone is one item, which search engines reject. */}
      {items.length > 0 ? (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Help', url: `${helpUrl}/` },
            ...items.map((item) => ({
              name: item.label,
              url: item.href ? `${helpUrl}${item.href}` : undefined,
            })),
          ])}
        />
      ) : null}
    </div>
  );
}
