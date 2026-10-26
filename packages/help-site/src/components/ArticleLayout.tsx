import { articleHref, categoryHref } from '@liveworkspace/help-registry/hrefs';
import { articleLink } from '../lib/neighbours';
import type { HelpSite } from '../site';
import { ArticleShell, type ArticleLayoutProps } from './ArticleShell';

// The layout every article's MDX renders (docs/specs/018-help/help-pages.md "Article pages"). A server component:
// it finds the article in the registry by its title and works out its category link and its previous and next
// articles, then hands those few links to the client half (ArticleShell). The registry stays on the server.
// Each app binds its site in components/ArticleLayout.tsx, the path its articles import.
export function ArticleLayout({ site, ...props }: ArticleLayoutProps & { site: HelpSite }) {
  const article = site.articleByTitle(props.title);
  if (!article) return <ArticleShell {...props} />;
  const { prev, next } = site.articleNeighbours(article);
  // A sub-article whose MDX names no parent (its categorySlug is the parent's path): the parent is the article at
  // that path, so the breadcrumb can name it rather than skipping a level.
  const parent =
    props.parentArticle ??
    (article.categorySlug.includes('/')
      ? site.catalogue.articles.find((a) => articleHref(a) === categoryHref(article.categorySlug))
      : undefined);
  return (
    <ArticleShell
      {...props}
      parentArticle={parent && { title: parent.title, slug: parent.slug }}
      category={site.articleCategoryLink(article)}
      prev={prev && articleLink(prev)}
      next={next && articleLink(next)}
    />
  );
}
