// livehuddle's template families as the shared Explorer takes them: the lens's Template filter, and an entry of
// Default Folders each ("Retrospective canvases"), matched against the last word of a canvas's creation intent
// ("diagram:diagram:retrospective").
import type { LensOption } from '@liveworkspace/explorer';
import { TEMPLATE_FAMILIES, type TemplateFamily } from '@livehuddle/api-schema';

const FAMILY_LABELS: Record<TemplateFamily, string> = {
  retrospective: 'Retrospective',
};

export const CANVAS_TEMPLATE_FAMILIES: readonly LensOption[] = TEMPLATE_FAMILIES.map((value) => ({
  value,
  label: FAMILY_LABELS[value],
}));
