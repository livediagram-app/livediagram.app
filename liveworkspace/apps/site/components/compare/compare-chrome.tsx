import { BreadcrumbTrail, breadcrumbJsonLd, JsonLd, type BreadcrumbItem } from '@livediagram/ui';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The pieces every comparison page shares (liveworkspace/docs/comparison-pages.md): the breadcrumb
// bar and its BreadcrumbList, the tinted hero band, and the page metadata.

const SITE = PLATFORM_SITE.url;

// The visible trail under the header. The root links to the front door; pass the trail after it.
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="border-b border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-7xl min-w-0 flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-slate-500 sm:px-6 dark:text-slate-400"
      >
        <BreadcrumbTrail items={items} rootLabel="Home" />
      </nav>
    </div>
  );
}

// schema.org BreadcrumbList for the same trail, Home first. `path` is the canonical path.
export function BreadcrumbJsonLd({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={breadcrumbJsonLd([
        { name: 'Home', url: SITE },
        ...trail.map((c) => ({ name: c.name, url: `${SITE}${c.path}` })),
      ])}
    />
  );
}

// The band that opens a comparison and the hub: an eyebrow pill, the h1, a lede, and a slot below
// (a comparison's vs tiles), washed in the voice's accent (--lw-accent, set by the page).
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200/70 bg-gradient-to-b from-[color-mix(in_srgb,var(--lw-accent)_12%,transparent)] to-transparent px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-20 dark:border-slate-800/70">
      <p className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[var(--lw-ink)] uppercase ring-1 ring-slate-200 dark:bg-slate-900 dark:text-[var(--lw-ink-dark)] dark:ring-slate-700">
        {eyebrow}
      </p>
      <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-slate-100">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
        {lede}
      </p>
      {children}
    </div>
  );
}

// A comparison page's metadata: its own title, description and canonical, shared as an article
// whose `article:modified_time` is the comparison's last review.
export function compareMetadata({
  title,
  description,
  path,
  modified,
}: {
  title: string;
  description: string;
  path: string;
  modified: Date;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: PLATFORM_SITE.name,
      type: 'article',
      modifiedTime: modified.toISOString(),
    },
    twitter: { card: 'summary', title, description },
  };
}
