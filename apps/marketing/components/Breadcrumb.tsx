// Marketing breadcrumb bar. The trail itself — home-icon root, chevron
// separators, truncating labels — is BreadcrumbTrail in @livediagram/ui, shared
// with the help centre so the two surfaces read consistently. This file owns
// the bar around it: a subtle full-width bar at marketing's own width, not
// sticky. Structured data is emitted separately via BreadcrumbJsonLd, so this
// component is presentation only. The root links to the marketing home; pass
// the trail after it.

import { BreadcrumbTrail, type BreadcrumbItem } from '@livediagram/ui';

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50/85 backdrop-blur">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center gap-2 px-6 py-2.5 text-sm text-slate-500"
      >
        <BreadcrumbTrail items={items} rootLabel="Home" />
      </nav>
    </div>
  );
}
