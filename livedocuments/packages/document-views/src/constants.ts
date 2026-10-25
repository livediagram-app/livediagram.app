// The view constants (docs/specs/024-agents/blueprints/document-views.md "Constants and configuration"):
// the shared ones, and the query bounds this product's api-schema keeps as wire contract.

export * from '@liveworkspace/document-views/constants';
// The query bounds are wire contract, kept beside the view names (VW53).
export {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  VIEW_BUDGET_MAX,
} from '@livedocuments/api-schema';
