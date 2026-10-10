// Which articles a page lock holds (docs/specs/007-editor/illustrate-pages.md "Locking a page"):
// locking any page of an article makes the whole article's writing read-only, holds its page count
// and zones as they are, and refuses the edits its pages share, from any of its pages. Pure, so the
// writing's entry points (useArticles, useArticleIntake), its chrome (ArticleFlows) and the page
// panel ask the same question the same way.
import { illustratePagesOf } from '@livediagram/document';

type LockablePage = { readonly id: string; readonly flow?: string; readonly locked?: true };

/** The articles (by flow id) with at least one page locked. */
export function lockedArticleFlows(pages: readonly LockablePage[]): Set<string> {
  const out = new Set<string>();
  for (const p of pages) if (p.flow && p.locked === true) out.add(p.flow);
  return out;
}

/** Whether a page is held by a lock: locked itself, or a page of an article with any page locked.
 *  An unknown page is not held. */
export function isArticleLocked(pages: readonly LockablePage[], pageId: string): boolean {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return false;
  if (page.locked === true) return true;
  return !!page.flow && pages.some((p) => p.flow === page.flow && p.locked === true);
}

/** Whether an article on a tab has any of its pages locked. */
export function articleLocked(tab: { pages?: unknown }, flow: string): boolean {
  return illustratePagesOf(tab).some((p) => p.flow === flow && p.locked === true);
}
