import type { Metadata } from 'next';
import { EXPLORER_ARTICLES, explorerArticlePath } from '@/lib/help/platform-help';
import { HelpArticle } from './HelpArticle';
import { EXPLORER_CONTENT } from './explorer-articles';

// One of liveworkspace.app's Explorer articles (liveworkspace/docs/specs/010-site/site.md "Help"), drawn in the site's
// own chrome with a row of its neighbours under it. Each route is a page of one line that names its slug.

const article = (slug: string) => {
  const found = EXPLORER_ARTICLES.find((a) => a.slug === slug);
  if (!found) throw new Error(`No Explorer article ${slug}`);
  return found;
};

/** The article's share metadata: its own title, description and canonical address. */
export function explorerHelpMetadata(slug: string): Metadata {
  const { title, description } = article(slug);
  const heading = `${title} · liveworkspace`;
  const path = explorerArticlePath(slug);
  return {
    title: heading,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: heading,
      description,
      url: path,
      siteName: 'liveworkspace',
      type: 'article',
    },
    twitter: { card: 'summary', title: heading, description },
  };
}

export function ExplorerHelpPage({ slug }: { slug: string }) {
  const { title } = article(slug);
  const content = EXPLORER_CONTENT[slug];
  if (!content) throw new Error(`No Explorer article text for ${slug}`);
  return (
    <HelpArticle
      heading={title}
      lede={content.lede}
      sections={content.sections}
      after={
        <>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            More about the Explorer
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {EXPLORER_ARTICLES.filter((a) => a.slug !== slug).map((a) => (
              <li key={a.slug}>
                <a
                  href={explorerArticlePath(a.slug)}
                  className="relative touch-target-y font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                >
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      }
    />
  );
}
