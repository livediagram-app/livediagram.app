import { articleHref, articles, categoryHref } from '@/lib/articles';
import { ArticleLayoutView, type ArticleLayoutProps } from './ArticleLayoutView';

// Every guide's page.mdx renders this. A server component, so the lookup below runs at build
// time: the whole article registry (about 300 articles with their descriptions and keywords)
// stays out of every article's JavaScript, which only needs this one page's URL.
//
// Article structured data (docs/specs/018-help/help-app.md): resolve this page's own URL from the
// registry ((categorySlug, title) is unique) so the TechArticle node ships on every guide without
// each page.mdx passing its slug.
export function ArticleLayout(props: ArticleLayoutProps) {
  const { categorySlug, title } = props;
  const entry = articles.find((a) => a.categorySlug === categorySlug && a.title === title);
  const selfHref = entry ? articleHref(entry) : categoryHref(categorySlug);
  return <ArticleLayoutView {...props} selfHref={selfHref} />;
}
