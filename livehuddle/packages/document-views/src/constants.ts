// The view constants (docs/specs/024-agents/blueprints/document-views.md "Constants and configuration"):
// the shared ones, this product's own, and the query bounds its api-schema keeps as wire contract.

export * from '@liveworkspace/document-views/constants';
// Entity fields an outline line lists before it folds the rest.
export const ENTITY_FIELDS_SHOWN = 8;
// The query bounds are wire contract, kept beside the view names (VW53).
export {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  VIEW_BUDGET_MAX,
} from '@livehuddle/api-schema';
