// The template library (spec/09 Quick Start + spec/62 MCP): the
// catalogue (kinds, titles, categories, canvas overrides) and the pure
// per-template element builders. Shared by the editor's picker and the
// MCP worker so the two can't drift.
export * from './templates';
export { buildTemplate } from './build-template';
