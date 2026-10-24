import type { ReactNode } from 'react';
import { articleHref, type Article } from '@liveworkspace/help-registry';
import { JsonLd } from '@liveworkspace/ui';
import type { HelpSite } from '../site';
import { Breadcrumb } from './Breadcrumb';
import { HelpHero } from './HelpHero';

// The chrome every top-level browse page in the help centre wears: a
// breadcrumb, a title, a lede, and a responsive grid of cards. Eleven pages
// (Getting Started, Features, Troubleshooting, About, Policies, ...) rendered
// this same tree inline, differing only in the three things that are props
// here. Changing the header design meant editing eleven files, and the class
// strings had to be retyped correctly each time a category was added.
//
// The breadcrumb label and the heading are ONE prop because on every one of
// those pages they were the same string. If a page ever needs them to differ
// it should say so explicitly rather than have every caller pass the value
// twice today.
//
// `/help/contact/` deliberately does NOT use this: it is a narrower column
// (max-w-3xl) with prose-weight body text and a stack of link cards rather
// than a grid, so it shares the look of the header but not the layout.
export function BrowsePage({
  site,
  title,
  lede,
  listing,
  eyebrow = 'Help Topic',
  children,
}: {
  site: HelpSite;
  title: string;
  /** The label above the title (docs/specs/018-help/help-pages.md "Shared look"). */
  eyebrow?: string;
  lede: string;
  // A category landing's own path and the registry articles it lists, for its CollectionPage
  // structured data (docs/specs/018-help/help-app.md "SEO"). Pages that list something else leave it out.
  listing?: { appPath: string; articles: Article[] };
  children: ReactNode;
}) {
  // A category landing shows its category's scene; its slug is the first segment of its path.
  const Art = listing
    ? site.art.categoryArt[listing.appPath.split('/').filter(Boolean)[0] ?? '']
    : undefined;
  return (
    <div>
      {listing && (
        <JsonLd
          data={site.collectionJsonLd({
            title,
            description: lede,
            appPath: listing.appPath,
            items: listing.articles.map((a) => ({ name: a.title, appPath: articleHref(a) })),
          })}
        />
      )}
      <Breadcrumb items={[{ label: title }]} helpUrl={site.facts.helpUrl} />
      <HelpHero eyebrow={eyebrow} title={title} lede={lede} art={Art ? <Art /> : undefined} />
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        {/* The cards title themselves with h3, so the grid gets the h2 between them and the page's h1
            that a screen reader's heading list (and Lighthouse's heading-order audit) expects. */}
        <h2 className="sr-only">Guides</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </div>
  );
}
