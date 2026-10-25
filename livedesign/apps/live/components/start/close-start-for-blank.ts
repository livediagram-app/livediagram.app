// An explicit blank starts blank (docs/specs/007-editor/start-diagramming.md "When it shows"): a design made by
// Skip, Start Blank (`/new?blank=1`) or a blank's `/new?template=` link opens with its tab's start already closed, so
// someone who asked for nothing gets nothing over the canvas.
import { isBlankTemplate, templateEditorMode, type TemplateKind } from '@livedesign/templates';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { startClosedKey } from './start-closed-key';

export function closeStartForBlank(tabId: string, kind: TemplateKind | null): boolean {
  if (!kind || !isBlankTemplate(kind)) return false;
  dismissEmptyCard(startClosedKey(tabId, templateEditorMode(kind)));
  return true;
}
