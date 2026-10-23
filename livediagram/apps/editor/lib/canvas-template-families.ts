// livediagram's template families as the shared Explorer takes them: the lens's Template filter, and an entry of
// Default Folders each ("Kanban canvases"), matched against the last word of a canvas's creation intent
// ("diagram:diagram:kanban").
import type { LensOption } from '@liveworkspace/explorer';
import { TEMPLATE_FAMILIES, type TemplateFamily } from '@livediagram/api-schema';

const FAMILY_LABELS: Record<TemplateFamily, string> = {
  retrospective: 'Retrospective',
  kanban: 'Kanban',
};

export const CANVAS_TEMPLATE_FAMILIES: readonly LensOption[] = TEMPLATE_FAMILIES.map((value) => ({
  value,
  label: FAMILY_LABELS[value],
}));
