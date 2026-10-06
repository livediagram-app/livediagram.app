// The template library (docs/specs/008-canvas/canvas-and-palette.md Quick Start + docs/specs/015-api/mcp-server.md MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// MCP worker so the two can't drift.
export * from './templates';
export * from './template-modes';
export { isUntitledDocumentName } from './legacy-untitled';
export * from './template-layers';
export { buildTemplate } from './build-template';
export { templateFamilyOf } from './template-families';
export {
  PLAN_TEMPLATE_KINDS,
  isPlanTemplateKind,
  type PlanTemplateKind,
} from './template-builders-plan';
export * from './page-layouts';
export * from './template-tab';
export { templateCatalogue, type TemplateCatalogue } from './template-catalogue';
