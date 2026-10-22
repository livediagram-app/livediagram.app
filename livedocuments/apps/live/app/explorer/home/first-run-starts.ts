// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"): the starts the welcome offers and where
// each leads, picked from the templates package's catalogue. Its own module, read only by the lazily loaded welcome
// and the hero's template fan, so the catalogue never weighs on any other Home.

import {
  BLANK_TEMPLATE_FOR_MODE,
  EXTRA_BLANK_TEMPLATES,
  POPULAR_TEMPLATE_KINDS,
  isBlankTemplate,
  templateCreateHref,
  type TemplateKind,
} from '@livedocuments/templates';

/** How many Popular templates the welcome shows. */
export const WELCOME_TEMPLATES_MAX = 8;

/** How many blanks Start Blank shows: one row of its grid. */
export const WELCOME_BLANKS_MAX = 5;

/** The three previews fanned in the hero, the front one first. */
export const WELCOME_FAN: readonly TemplateKind[] = [
  'slide-deck',
  'event-poster',
  'year-in-review',
];

/** Start Blank: Pages' blank, then the first blanks of a page kind (docs/specs/007-editor/start-diagramming.md
 *  "Recommended and groups"), cut to WELCOME_BLANKS_MAX. */
export const WELCOME_BLANKS: readonly TemplateKind[] = [
  BLANK_TEMPLATE_FOR_MODE.pages,
  ...EXTRA_BLANK_TEMPLATES,
].slice(0, WELCOME_BLANKS_MAX);

/** Popular Templates: the shared Popular list without its blanks, cut to WELCOME_TEMPLATES_MAX. */
export const WELCOME_POPULAR: readonly TemplateKind[] = POPULAR_TEMPLATE_KINDS.filter(
  (kind) => !isBlankTemplate(kind),
).slice(0, WELCOME_TEMPLATES_MAX);

/** Making one start at once. */
export const welcomeStartHref = (kind: TemplateKind): string => templateCreateHref(kind);
