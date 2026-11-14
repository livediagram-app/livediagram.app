// @livehuddle/document-views (docs/specs/024-agents/document-views.md): read-only text projections of
// a tab, each a pure function of it. The api renders through `renderView`; `overviewView`
// summarises a document.
export * from './constants';
export {
  estimateTokens,
  type ViewFit,
  type ViewResult,
} from '@liveworkspace/document-views/budget';
export { buildViewModel, headerFactsOf, type ViewContext, type ViewModel } from './model';
export { headerLine, type HeaderFacts } from './header';
export { renderView, type ViewRequest } from './render-view';
export { overviewView, editedAge, type OverviewTabInput } from './overview';
export { PERSON_ID_FIELDS } from './show';
export { commentHosts } from './comments';
