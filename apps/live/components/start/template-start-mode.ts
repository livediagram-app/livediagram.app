// Which template start an empty tab shows (docs/specs/007-editor/start-diagramming.md "When it shows"): Start
// Diagramming, Start Drawing, Start Facilitating or Start Illustrating, to someone who can edit, while the tab is
// empty, outside zen and embed, with no draw tool armed. Draw keeps a pen in hand on an empty
// tab, so there an armed pen does not hide it. Empty is no elements, and on an Illustrate tab its one page still
// unchosen (the page's own What Is This Page For? waits under the panel). Plan has Start Planning.
import type { EditorMode, IllustratePage } from '@livediagram/document';
import type { TemplateStartMode } from './start-template-items';

export function templateStartMode(at: {
  hydrated: boolean;
  zen: boolean;
  embed: boolean;
  readOnly: boolean;
  drawToolArmed: boolean;
  mode: EditorMode;
  elementCount: number;
  pages: readonly Pick<IllustratePage, 'kind'>[];
}): TemplateStartMode | null {
  if (!at.hydrated || at.zen || at.embed || at.readOnly) return null;
  if (at.drawToolArmed && at.mode !== 'draw') return null;
  if (at.elementCount > 0) return null;
  if (at.mode === 'diagram' || at.mode === 'draw' || at.mode === 'facilitate') return at.mode;
  if (at.mode === 'illustrate' && at.pages.length <= 1 && !at.pages[0]?.kind) return 'illustrate';
  return null;
}
