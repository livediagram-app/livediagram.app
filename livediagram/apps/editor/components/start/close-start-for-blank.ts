// An explicit blank starts blank (docs/specs/007-editor/start-diagramming.md "When it shows"): a document made by
// Skip, Start Blank (`/new?blank=1`) or a blank's `/new?template=` link opens with its tab's start already closed, so
// someone who asked for nothing gets nothing over the canvas. Choosing a mode on the wizard's Mode step makes the same
// blank but keeps the start, since it asked for templates next, unless the visit came from a Start Blank link
// (`/new?start=blank`), which already said no templates.
import { isBlankTemplate, templateEditorMode, type TemplateKind } from '@livediagram/templates';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { startClosedKey } from './start-closed-key';

export function closeStartForBlank(tabId: string, kind: TemplateKind | null): boolean {
  if (!kind || !isBlankTemplate(kind)) return false;
  dismissEmptyCard(startClosedKey(tabId, templateEditorMode(kind)));
  return true;
}
