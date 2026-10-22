// Agents' Pages edits (docs/specs/024-agents/pages-for-agents.md): page changes applied to a tab,
// the request read from the wire, and the summaries answered.
export { parsePagesRequest } from './parse';
export { applyPageChanges, backgroundPatch, type PageChangesOutcome } from './page-changes';
export { enterPages, type PagesIds } from './enter';
export { describeBackground, pageLabel, pageSummaries, resolvePage, sizeLabel } from './summary';
