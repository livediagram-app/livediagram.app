// The template library (docs/specs/008-canvas/canvas-and-palette.md Quick Start + docs/specs/015-api/mcp-server.md MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// MCP worker so the two can't drift.
export * from './templates';
export * from './template-layers';
export { buildTemplate } from './build-template';
