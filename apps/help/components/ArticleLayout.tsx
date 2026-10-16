import { ArticleShell, type ArticleLayoutProps } from './ArticleShell';
import {
  articleByTitle,
  articleCategoryLink,
  articleLink,
  articleNeighbours,
} from '@/lib/article-neighbours';

// The layout every article's MDX renders (docs/specs/018-help/help-pages.md "Article pages"). A server component:
// it finds the article in the registry by its title and works out its category link and its previous and next
// articles, then hands those few links to the client half (ArticleShell). The registry stays on the server.
export function ArticleLayout(props: ArticleLayoutProps) {
  const article = articleByTitle(props.title);
  if (!article) return <ArticleShell {...props} />;
  const { prev, next } = articleNeighbours(article);
  return (
    <ArticleShell
      {...props}
      category={articleCategoryLink(article)}
      prev={prev && articleLink(prev)}
      next={next && articleLink(next)}
    />
  );
}
