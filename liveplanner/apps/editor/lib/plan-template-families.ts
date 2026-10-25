// liveplanner's template families as the shared Explorer takes them: the lens's Template filter, and an entry of
// Default Folders each ("Kanban plans"), matched against the last word of a plan's creation intent
// ("plan:board:kanban").
import type { LensOption } from '@liveworkspace/explorer';
import { TEMPLATE_FAMILIES, type TemplateFamily } from '@liveplanner/api-schema';

const FAMILY_LABELS: Record<TemplateFamily, string> = {
  retrospective: 'Retrospective',
  kanban: 'Kanban',
};

export const PLAN_TEMPLATE_FAMILIES: readonly LensOption[] = TEMPLATE_FAMILIES.map((value) => ({
  value,
  label: FAMILY_LABELS[value],
}));
