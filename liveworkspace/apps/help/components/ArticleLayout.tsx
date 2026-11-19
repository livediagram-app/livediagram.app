import { ArticleLayout as SharedArticleLayout } from '@liveworkspace/help-site/components/ArticleLayout';
import type { ArticleLayoutProps } from '@liveworkspace/help-site/components/ArticleShell';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { appliesTo, articlePath, type Article } from '@liveworkspace/help-registry';
import { site } from '@/lib/help-site';
import { SCOPE } from '@/lib/scope.generated';

// The layout every article's MDX imports (liveworkspace/docs/specs/016-help/help-centre.md "Article pages"), bound to this help
// centre. Kept at this path because every article imports it.
//
// An article's MDX passes its shared title, and an app may word the article its own way (Article.byApp,
// liveworkspace/docs/specs/016-help/help-centre.md "Per-app wording"). So the page is found in the catalogue by
// that shared title and its category, then handed to the layout as the scope's entry at the same path, whose title
// and description are the ones the page shows. Server-side only.

const byPath = new Map(site.catalogue.articles.map((a) => [articlePath(a), a]));

function scopeEntry(props: ArticleLayoutProps): Article | undefined {
  const named = allArticles.filter((a) => a.title === props.title);
  const here =
    named.find((a) => a.categorySlug === props.categorySlug && appliesTo(a, SCOPE)) ??
    named.find((a) => appliesTo(a, SCOPE));
  return here && byPath.get(articlePath(here));
}

export function ArticleLayout(props: ArticleLayoutProps) {
  return <SharedArticleLayout site={site} article={scopeEntry(props)} {...props} />;
}
