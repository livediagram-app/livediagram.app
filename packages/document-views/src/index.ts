// @livediagram/document-views (docs/specs/024-agents/document-views.md): read-only text projections of
// a tab, each a pure function of it.
export * from './constants';
export { buildViewModel, type ViewContext, type ViewModel } from './model';
export { cutAtWord, jsonString, attrValue, cellText } from './text';
