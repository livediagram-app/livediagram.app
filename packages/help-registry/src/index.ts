// The help centre's shared shapes and lookups (docs/specs/018-help/help-app.md in each product). Each product's
// @<product>/help-registry holds its catalogue and binds these to it; nothing here holds articles.

export { articleHref, categoryHref } from './hrefs';
export { createHelpRegistry, type HelpRegistry } from './registry';
export { articlePath, createHelpTelemetryIds, type HelpTelemetryIds } from './telemetry';
export { topCategorySlug, type Article, type Category } from './types';
