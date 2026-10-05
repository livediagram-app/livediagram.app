// @livediagram/document-views (docs/specs/024-agents/document-views.md): read-only text projections of
// a tab, each a pure function of it. The api and the CLI render through `renderView`; `overviewView`
// summarises a document and `diffView` compares two reads of a tab.
export * from './constants';
export { estimateTokens, type ViewFit, type ViewResult } from './budget';
export { buildViewModel, headerFactsOf, type ViewContext, type ViewModel } from './model';
export type { HeaderFacts } from './header';
export { renderView, type RenderedView, type ViewRefusal, type ViewRequest } from './render-view';
export { overviewView, editedAge, type OverviewDocument, type OverviewTabInput } from './overview';
export { diffView, type DiffContext } from './diff';
export { PERSON_ID_FIELDS } from './show';
export { commentHosts } from './comments';
