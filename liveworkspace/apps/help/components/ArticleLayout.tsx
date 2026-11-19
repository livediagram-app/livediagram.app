import { ArticleLayout as SharedArticleLayout } from '@liveworkspace/help-site/components/ArticleLayout';
import type { ArticleLayoutProps } from '@liveworkspace/help-site/components/ArticleShell';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { appliesTo, articlePath, type Article } from '@liveworkspace/help-registry';
import { site } from '@/lib/help-site';
import { SCOPE } from '@/lib/scope.generated';

// The layout every article's MDX imports (liveworkspace/docs/specs/017-help/help-centre.md "Article pages"), bound to this help
// centre. Kept at this path because every article imports it.
//
// An article's MDX passes its path (and its shared title), and an app may word the article its own way
// (Article.byApp, liveworkspace/docs/specs/017-help/help-centre.md "Per-app wording"). So the page is handed to the
// layout as the scope's entry at its path, whose title and description are the ones the page shows. A path this
// scope does not hold is a page its build renders and then drops: it gets no entry. Server-side only.

const byPath = new Map(site.catalogue.articles.map((a) => [articlePath(a), a]));

function scopeEntry(props: ArticleLayoutProps): Article | undefined {
  if (props.path) return byPath.get(props.path.replace(/^\/+|\/+$/g, ''));
  const named = allArticles.filter((a) => a.title === props.title);
  const here =
    named.find((a) => a.categorySlug === props.categorySlug && appliesTo(a, SCOPE)) ??
    named.find((a) => appliesTo(a, SCOPE));
  return here && byPath.get(articlePath(here));
}

export function ArticleLayout(props: ArticleLayoutProps) {
  return <SharedArticleLayout site={site} article={scopeEntry(props)} {...props} />;
}
