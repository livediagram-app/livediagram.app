// The Plan templates' own card types, provided as every path that makes a template's tabs provides them
// (docs/specs/026-plan/plan-templates.md "Card types a template makes"), for the tests that make them.
import { provideTemplateCardTypes } from '@liveplanner/items';
import { TEMPLATE_CARD_TYPES } from '@liveplanner/items/template-card-types';

provideTemplateCardTypes(TEMPLATE_CARD_TYPES);
