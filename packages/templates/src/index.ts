// The template library (docs/specs/008-canvas/canvas-and-palette.md Quick Start + docs/specs/015-api/mcp-server.md MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// MCP worker so the two can't drift.
export * from './templates';
export * from './template-modes';
export { MODE_BEST, POPULAR_PER_MODE, popularKindsFor } from './popular';
export { isUntitledDocumentName } from './legacy-untitled';
export * from './template-layers';
export { buildTemplate, templateTabs, type TemplateTabDef } from './build-template';
export { templateFamilyOf } from './template-families';
export {
  PLAN_TEMPLATE_KINDS,
  isPlanTemplateKind,
  type PlanTemplateKind,
} from './template-builders-plan';
export * from './page-layouts';
export * from './slide-layouts';
export * from './logo-layouts';
export * from './layout-catalogue';
export * from './template-tab';
export { templateCatalogue, type TemplateCatalogue } from './template-catalogue';
// The engine-free check; materialiseTemplateSheets (which carries the sheets engine) is the
// '@livediagram/templates/template-sheets' subpath, so only a caller making sheets bundles it.
export { hasTemplateSheets } from './template-sheet-marks';
