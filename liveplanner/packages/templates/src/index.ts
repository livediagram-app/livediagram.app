// The template library (docs/specs/008-canvas/canvas-and-palette.md Quick Start + docs/specs/015-api/mcp-server.md MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// MCP worker so the two can't drift.
export * from './templates';
export * from './template-canvas-overrides';
export * from './template-modes';
export * from './template-categories';
export { templateKeywords } from './template-keywords';
export { templateMatchesQuery, templateQueryWords } from './template-search';
export {
  POPULAR_BY_MODE,
  POPULAR_PER_MODE,
  POPULAR_TEMPLATE_KINDS,
  popularKindsFor,
} from './popular';
export { isUntitledDocumentName, UNTITLED_DOCUMENT_NAME } from './legacy-untitled';
export * from './template-layers';
export { buildTemplate, templateTabs, type TemplateTabDef } from './build-template';
export { templateFamilyOf } from './template-families';
export {
  PLAN_TEMPLATE_KINDS,
  isPlanTemplateKind,
  type PlanTemplateKind,
} from './template-builders-plan';
export { isSpreadsheetPlanTemplate, planTemplateTabCount } from './plan-template-catalogue';
export * from './page-layouts';
export * from './slide-layouts';
export * from './logo-layouts';
export * from './layout-catalogue';
export { buildPageLayout, buildPageLayoutOver } from './page-layout-build';
export { carryPageContent, warmLayoutPlaceholders } from './page-layout-carry';
export * from './template-tab';
export * from './dashboard-builder';
export { templateCatalogue } from './template-catalogue';
// The engine-free check; materialiseTemplateSheets (which carries the sheets engine) is the
// '@liveplanner/templates/template-sheets' subpath, so only a caller making sheets bundles it.
export { hasTemplateSheets } from './template-sheet-marks';
export { withBlankPageThemed } from './blank-page-templates';

export * from './form-templates';
export * from './form-start';
export * from './linked-board-start';
