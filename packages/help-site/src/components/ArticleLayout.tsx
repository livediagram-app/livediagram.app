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
  return (
    <ArticleShell
      {...props}
      category={site.articleCategoryLink(article)}
      prev={prev && articleLink(prev)}
      next={next && articleLink(next)}
    />
  );
}
