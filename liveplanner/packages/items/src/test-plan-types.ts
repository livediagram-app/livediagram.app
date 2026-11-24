// Test helper: the built-in types with a Blocked By field on Task, as a plan that links its cards has them.
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';

export const BLOCKED_BY: CustomFieldDef = {
  id: 'f-blocked-by',
  label: 'Blocked By',
  kind: 'card',
  linkType: 'task',
  multiple: true,
  blocks: true,
};
const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, BLOCKED_BY.id],
  custom: [...(BASE.custom ?? []), BLOCKED_BY],
};
export const PLAN_TYPES: readonly ItemTypeDef[] = [
  TASK,
  ...ITEM_TYPES.filter((t) => t.id !== 'task'),
];
