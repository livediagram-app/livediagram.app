// livehuddle's template families as the shared Explorer takes them: the lens's Template filter, and an entry of
// Default Folders each, matched against the last word of a space's creation intent. None today: the Retrospective
// family left (Work Tracker #507), and a default stored for it reads as Spaces (RETIRED_PLACEMENT_KEYS).
import type { LensOption } from '@liveworkspace/explorer';
import { TEMPLATE_FAMILIES, type TemplateFamily } from '@livehuddle/api-schema';

const FAMILY_LABELS: Record<TemplateFamily, string> = {};

export const CANVAS_TEMPLATE_FAMILIES: readonly LensOption[] = TEMPLATE_FAMILIES.map((value) => ({
  value,
  label: FAMILY_LABELS[value],
}));
