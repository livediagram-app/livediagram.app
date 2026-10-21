// Select All's reach (the canvas's Cmd/Ctrl+A): every element a press could reach, less those on
// hidden or locked layers (docs/specs/006-document/layers.md); in Pages mode only those on the page
// someone is on (docs/specs/007-editor/pages-mode.md "Selecting on a page"), so a tab of many
// pages never selects across them. Off every page, or with no page known yet, the whole tab.
import {
  elementIdsOnPage,
  layOutPages,
  pagesOf,
  type EditorMode,
  type Tab,
} from '@livediagram/document';

export function selectAllIds(
  tab: Pick<Tab, 'elements' | 'pages'> & { pageOrientation?: unknown },
  mode: EditorMode,
  inert: ReadonlySet<string>,
  currentPageId: string | null,
): Set<string> {
  const reachable = tab.elements.map((el) => el.id).filter((id) => !inert.has(id));
  if (mode !== 'pages' || !currentPageId) return new Set(reachable);
  const pages = layOutPages(pagesOf(tab));
  if (!pages.some((p) => p.id === currentPageId)) return new Set(reachable);
  const onPage = elementIdsOnPage(tab.elements, pages, currentPageId);
  return new Set(reachable.filter((id) => onPage.has(id)));
}
