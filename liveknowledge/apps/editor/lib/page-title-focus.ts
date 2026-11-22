// The pages whose Title takes the caret when they next open (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "A knowledgebase" and "Add"): a page made here by New Page, Add Subpage or Create Page, and a new knowledgebase's
// first page. Kept outside React, in this browser tab only: /new asks before the editor mounts in its place, and the
// editor takes the ask once the page's writing is on screen (hooks/editor/usePageTitleFocus.ts).
import { isBlankTemplate, type TemplateKind } from '@liveknowledge/templates';

// Each page asked for, with what had focus when it was asked (null outside a browser).
const wanted = new Map<string, Element | null>();

/** An ask the editor answers: `from` is what had focus when the page was asked for. */
export type TitleFocusAsk = { from: Element | null };

/** Whether a knowledgebase made from `kind` opens with the caret in its first page's Title: one made from no
 *  template, or from a blank one (`/new?blank=1` names the Blank Page template), whose page has nothing written yet.
 *  A template with writing takes none. */
export function newKnowledgebaseTakesCaret(kind: TemplateKind | null): boolean {
  return !kind || isBlankTemplate(kind);
}

/** Asks that the page's Title take the caret when it opens. */
export function wantTitleFocus(pageId: string): void {
  wanted.set(pageId, typeof document === 'undefined' ? null : document.activeElement);
}

/** The page's ask, or null when it was not asked for; the ask is spent by the answer. */
export function takeTitleFocus(pageId: string): TitleFocusAsk | null {
  if (!wanted.has(pageId)) return null;
  const from = wanted.get(pageId) ?? null;
  wanted.delete(pageId);
  return { from };
}

/** Whether the person has put focus somewhere of their own since `from` had it, so a late caret must leave it
 *  (docs/specs/030-knowledgebase/editing.md "Edit mode"): the Title comes a moment after the page shows, and by then
 *  a keyboard user may be in a menu. Focus on nothing, on `from` (the control that made the page), on the canvas
 *  surface the editor opens on, or already in the writing is not theirs to keep. The canvas holds the floating
 *  panels too (the sidebar, its menus), so only the surface itself counts, not what is inside it. */
export function focusMovedSince(from: Element | null, doc: Document = document): boolean {
  const now = doc.activeElement;
  if (!now || now === doc.body || now === doc.documentElement || now === from) return false;
  return !now.matches('[data-canvas-a11y-root]') && !now.closest('.ProseMirror');
}

/** Whether the page was asked for, leaving the ask for the Title to take: a page made here opens in edit mode
 *  (docs/specs/030-knowledgebase/editing.md "Edit mode"). */
export function wantsTitleFocus(pageId: string): boolean {
  return wanted.has(pageId);
}

/** Forgets every ask (tests). */
export function clearTitleFocus(): void {
  wanted.clear();
}
