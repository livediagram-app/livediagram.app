// The template library (docs/specs/008-canvas/canvas-and-palette.md Quick Start + livediagram/docs/specs/015-api/mcp-server.md MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// api's template doors so the two can't drift.
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
export { buildTemplate } from './build-template';
export { BLANK_PAD_DROP } from './blank-pad-drop';
export { templateFamilyOf } from './template-families';
export * from './template-tab';
export { templateFloors, type TemplateFloor } from './template-floors';
export { templateFirstFloorName } from './template-floor-names';
export { templateCatalogue } from './template-catalogue';
