// The pages whose Title takes the caret when they next open (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "A knowledgebase" and "Add"): a page made here by New Page, Add Subpage or Create Page, and a new knowledgebase's
// first page. Kept outside React, in this browser tab only: /new asks before the editor mounts in its place, and the
// editor takes the ask once the page's writing is on screen (hooks/editor/usePageTitleFocus.ts).
import { isBlankTemplate, type TemplateKind } from '@liveknowledge/templates';

const wanted = new Set<string>();

/** Whether a knowledgebase made from `kind` opens with the caret in its first page's Title: one made from no
 *  template, or from a blank one (`/new?blank=1` names the Blank Page template), whose page has nothing written yet.
 *  A template with writing takes none. */
export function newKnowledgebaseTakesCaret(kind: TemplateKind | null): boolean {
  return !kind || isBlankTemplate(kind);
}

/** Asks that the page's Title take the caret when it opens. */
export function wantTitleFocus(pageId: string): void {
  wanted.add(pageId);
}

/** Whether the page was asked for; the ask is spent by the answer. */
export function takeTitleFocus(pageId: string): boolean {
  return wanted.delete(pageId);
}

/** Forgets every ask (tests). */
export function clearTitleFocus(): void {
  wanted.clear();
}
