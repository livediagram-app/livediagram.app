import { ArticleLayout as SharedArticleLayout } from '@liveworkspace/help-site/components/ArticleLayout';
import type { ArticleLayoutProps } from '@liveworkspace/help-site/components/ArticleShell';
import { site } from '@/lib/help-site';

// The layout every article's MDX imports (docs/specs/018-help/help-pages.md "Article pages"), bound to this help
// centre. Kept at this path because every article imports it.
export function ArticleLayout(props: ArticleLayoutProps) {
  return <SharedArticleLayout site={site} {...props} />;
}
