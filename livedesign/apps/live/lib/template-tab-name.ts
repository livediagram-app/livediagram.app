// The name a template gives the tab it fills, from a start and /new alike: the template's title, whatever the tab
// was called before. A blank template gives none, so the tab keeps its name.
import { TEMPLATES, isBlankTemplate, type TemplateKind } from '@livedesign/templates';

export function templateTabName(kind: TemplateKind): string | null {
  if (isBlankTemplate(kind)) return null;
  return TEMPLATES.find((t) => t.kind === kind)?.title ?? null;
}
