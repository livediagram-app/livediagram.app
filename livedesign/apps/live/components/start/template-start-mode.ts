// Whether an empty tab shows its template start (docs/specs/007-editor/start-diagramming.md "When it shows"): Start
// Making Pages, to someone who can edit, while the tab is empty, outside zen and embed, with no draw tool armed. Empty
// is no elements and its one page still unchosen (the page's own What Is This Page For? waits under the panel).
import type { EditorMode, Page } from '@livedesign/document';

export function templateStartMode(at: {
  hydrated: boolean;
  zen: boolean;
  embed: boolean;
  readOnly: boolean;
  drawToolArmed: boolean;
  mode: EditorMode;
  elementCount: number;
  pages: readonly Pick<Page, 'kind'>[];
}): EditorMode | null {
  if (!at.hydrated || at.zen || at.embed || at.readOnly || at.drawToolArmed) return null;
  if (at.elementCount > 0) return null;
  if (at.pages.length <= 1 && !at.pages[0]?.kind) return at.mode;
  return null;
}
