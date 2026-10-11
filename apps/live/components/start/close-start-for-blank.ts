// An explicit blank starts blank (docs/specs/007-editor/start-diagramming.md "When it shows"): a document made by
// Skip, Start Blank (`/new?blank=1`) or a blank's `/new?template=` link opens with its tab's start already closed, so
// someone who asked for nothing gets nothing over the canvas. Choosing a mode on the wizard's Mode step makes the same
// blank but keeps the start, since it asked for templates next. Plan's start cannot be closed, so a Plan blank keeps it.
import { isBlankTemplate, templateEditorMode, type TemplateKind } from '@livediagram/templates';
import { dismissEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { startClosedKey } from './start-closed-key';

export function closeStartForBlank(tabId: string, kind: TemplateKind | null): boolean {
  if (!kind || !isBlankTemplate(kind)) return false;
  const mode = templateEditorMode(kind);
  if (mode === 'plan') return false;
  dismissEmptyCard(startClosedKey(tabId, mode));
  return true;
}
