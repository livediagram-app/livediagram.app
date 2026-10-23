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
export * from './template-tab';
export { templateCatalogue } from './template-catalogue';
