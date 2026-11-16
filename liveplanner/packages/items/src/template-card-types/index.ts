// The Plan templates' own card types (docs/specs/026-plan/plan-templates.md "Card types a template makes"): each
// template makes the types its work needs, named, fielded and coloured for it, with its own card templates, and none
// of the five default types or the ready-made types the board presets share. Each id starts with its template's
// prefix, so no two templates' types meet. A template's boards bring them as any board brings a type
// (catalogueWithBoardTypes). Pure data.
import type { ItemTypeDef } from '../item-types';
import { BUSINESS_TYPES } from './business';
import { DELIVERY_TYPES } from './delivery';
import { withComments } from './kit';
import { PERSONAL_TYPES } from './personal';

export const TEMPLATE_CARD_TYPES: readonly ItemTypeDef[] = withComments([
  ...DELIVERY_TYPES,
  ...PERSONAL_TYPES,
  ...BUSINESS_TYPES,
]);

export { COMPLETED_ON } from './kit';
