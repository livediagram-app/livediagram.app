import type { ReactNode } from 'react';
import { APP_ORDER, topCategorySlug, type Article } from '@liveworkspace/help-registry';
import { articleHref, categoryHref } from '@liveworkspace/help-registry/hrefs';
import { articleLink } from '../lib/neighbours';
import type { HelpSite } from '../site';
import { AppNotesFold, findAppNotes, notedApps, SameIn } from './AppNote';
import { ArticleShell, type ArticleLayoutProps, type ReadInLink } from './ArticleShell';

// The layout every article's MDX renders (liveworkspace/docs/specs/017-help/help-centre.md "Article pages"). A server component:
// it finds the article in the registry by its title and works out its category link and its previous and next
// articles, then hands those few links to the client half (ArticleShell). The registry stays on the server.
// Each app binds its site in components/ArticleLayout.tsx, the path its articles import.
//
// In the one help centre (liveworkspace/docs/specs/017-help/help-centre.md "Articles and the apps they apply to") it
// also reads the article's apps: the Applies To row, the Read It In list, and the app notes. It finds every
// <AppNote> in the body, fails the build on a note for an app the article does not apply to, and in an app's help
// places the other apps' notes in one closed row at the end (AppNote hides them in place), then the apps with no
// note in one quiet line.

/** The registry article an MDX page is: by its path when the page names it (every article does), else by title,
 *  where two articles sharing one are told apart by the page's category (and parent). A path the scope's catalogue
 *  does not hold is a page outside this scope (each app's build renders every page, then drops those): it gets no
 *  entry, never another article that happens to share its title. */
export function findArticle(site: HelpSite, props: ArticleLayoutProps): Article | undefined {
  if (props.path) {
    const path = props.path.replace(/^\/+|\/+$/g, '');
    return site.catalogue.articles.find((a) => `${a.categorySlug}/${a.slug}` === path);
  }
  const byTitle = site.catalogue.articles.filter((a) => a.title === props.title);
  if (byTitle.length <= 1) return byTitle[0] ?? site.articleByTitle(props.title);
  const top = topCategorySlug(props.categorySlug);
  const inCategory = byTitle.filter(
    (a) => a.categorySlug === props.categorySlug || topCategorySlug(a.categorySlug) === top,
  );
  const parent = props.parentArticle?.slug;
  return (
    (parent && inCategory.find((a) => a.categorySlug.endsWith(`/${parent}`))) ||
    inCategory[0] ||
    byTitle[0]
  );
}

/** The fold and the same-in line for an article in the site's scope, after checking its notes. */
function appNotesAfter(site: HelpSite, article: Article, children: ReactNode): ReactNode {
  const scope = site.scope;
  if (!scope) return undefined;
  const notes = findAppNotes(children);
  for (const note of notes)
    for (const app of note.apps)
      if (!article.apps.includes(app))
        throw new Error(
          `[help] "${article.title}": <AppNote app="${note.apps.join(',')}"> names ${app}, which the article does not apply to (${article.apps.join(', ')})`,
        );
  if (notes.length === 0) return undefined;
  const noted = new Set(notedApps(notes));
  const same = APP_ORDER.filter(
    (a) => article.apps.includes(a) && !noted.has(a) && (scope === 'all' || a !== scope),
  );
  return (
    <>
      {scope !== 'all' && <AppNotesFold notes={notes} scope={scope} />}
      <SameIn apps={same} />
    </>
  );
}

/** The page's words in the site's scope (help-centre.md "Per-app wording"): where the scope's catalogue entry or
 *  its category carries the app's own wording, the title, description and category crumb follow it; otherwise the
 *  MDX's own props stand. */
function wordedProps(
  site: HelpSite,
  article: Article,
  props: ArticleLayoutProps,
): ArticleLayoutProps {
  const scope = site.scope;
  if (!scope || scope === 'all') return props;
  const own = article.byApp?.[scope];
  const top = topCategorySlug(article.categorySlug);
  const category = site.catalogue.categories.find((c) => c.slug === top);
  const ownCategory = category?.byApp?.[scope];
  if (!own && !ownCategory) return props;
  return {
    ...props,
    ...(own?.title !== undefined && { title: article.title }),
    ...(own?.description !== undefined && { description: article.description }),
    ...(ownCategory?.title !== undefined && category && { categoryTitle: category.title }),
  };
}

export function ArticleLayout({
  site,
  article: given,
  ...raw
}: ArticleLayoutProps & { site: HelpSite; article?: Article }) {
  // The app's binding may hand over the entry it found by the page's path (its MDX title is the shared one, which an
  // app's own wording replaces in the scope's catalogue).
  const article = given ?? findArticle(site, raw);
  if (!article) return <ArticleShell {...raw} />;
  const props = wordedProps(site, article, raw);
  const { prev, next } = site.articleNeighbours(article);
  // A sub-article whose MDX names no parent (its categorySlug is the parent's path): the parent is the article at
  // that path, so the breadcrumb can name it rather than skipping a level.
  // When the MDX's parent prop is the article at that path, the entry stands in for it, so its title is the
  // scope's wording too.
  const parentEntry = article.categorySlug.includes('/')
    ? site.catalogue.articles.find((a) => articleHref(a) === categoryHref(article.categorySlug))
    : undefined;
  const parent =
    props.parentArticle && props.parentArticle.slug !== parentEntry?.slug
      ? props.parentArticle
      : (parentEntry ?? props.parentArticle);
  const scope = site.scope;
  const readIn: ReadInLink[] | undefined = scope
    ? article.apps.map((app) => ({ app, href: articleHref(article, app), current: app === scope }))
    : undefined;
  return (
    <ArticleShell
      {...props}
      parentArticle={parent && { title: parent.title, slug: parent.slug }}
      category={site.articleCategoryLink(article)}
      prev={prev && articleLink(prev)}
      next={next && articleLink(next)}
      {...(scope && {
        scope,
        apps: article.apps,
        readIn,
        afterContent: appNotesAfter(site, article, props.children),
      })}
    />
  );
}
