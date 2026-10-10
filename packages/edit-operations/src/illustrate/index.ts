// Agents' Illustrate edits (docs/specs/024-agents/illustrate-for-agents.md): page changes and
// article writes applied to a tab, the request read from the wire, and the summaries answered.
export { parseIllustrateRequest } from './parse';
export { applyPageChanges, backgroundPatch, type PageChangesOutcome } from './page-changes';
export { applyArticleWrite, type ArticleWriteOutcome } from './article-write';
export { enterIllustrate, type IllustrateIds } from './enter';
export {
  articleSummaries,
  describeBackground,
  pageLabel,
  pageSummaries,
  resolvePage,
  sizeLabel,
} from './summary';
