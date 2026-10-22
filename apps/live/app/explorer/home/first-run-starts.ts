// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): the starts the welcome offers and where
// each leads, picked from the templates package's catalogue. Its own module, read only by the lazily loaded welcome
// and the hero's template fan, so the catalogue never weighs on any other Home.

import {
  POPULAR_TEMPLATE_KINDS,
  isBlankTemplate,
  templateCreateHref,
  type TemplateKind,
} from '@liveplanner/templates';

/** How many Popular templates the welcome shows. */
export const WELCOME_TEMPLATES_MAX = 8;

/** The three previews fanned in the hero, the front one first. */
export const WELCOME_FAN: readonly TemplateKind[] = ['kanban', 'project-planner', 'budget-planner'];

/** Start Blank: Plan's blanks, a board, a Sheet and a form. */
export const WELCOME_BLANKS: readonly TemplateKind[] = [
  'blank-plan',
  'blank-spreadsheet',
  'blank-form',
];

/** Popular Templates: the shared Popular list without its blanks, cut to WELCOME_TEMPLATES_MAX. */
export const WELCOME_POPULAR: readonly TemplateKind[] = POPULAR_TEMPLATE_KINDS.filter(
  (kind) => !isBlankTemplate(kind),
).slice(0, WELCOME_TEMPLATES_MAX);

/** Making one start at once. */
export const welcomeStartHref = (kind: TemplateKind): string => templateCreateHref(kind);
