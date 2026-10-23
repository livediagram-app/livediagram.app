// Whether an empty tab shows its template start (docs/specs/007-editor/start-diagramming.md "When it shows"): Start
// Making Pages, to someone who can edit, while the tab is empty, outside zen and embed, with no draw tool armed. Empty
// is no elements and its one page still unchosen (the page's own What Is This Page For? waits under the panel).
import type { Page } from '@livedocuments/document';

export function showsTemplateStart(at: {
  hydrated: boolean;
  zen: boolean;
  embed: boolean;
  readOnly: boolean;
  drawToolArmed: boolean;
  elementCount: number;
  pages: readonly Pick<Page, 'kind'>[];
}): boolean {
  if (!at.hydrated || at.zen || at.embed || at.readOnly || at.drawToolArmed) return false;
  if (at.elementCount > 0) return false;
  return at.pages.length <= 1 && !at.pages[0]?.kind;
}
