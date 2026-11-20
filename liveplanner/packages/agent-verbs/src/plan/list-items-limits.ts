// list_items' limits (docs/specs/026-plan/blueprints/plan-agents.md "Constants and configuration"; Work Tracker 900), on
// their own so the MCP schema reads them without the Plan engine.

// The most characters an answer's text holds (JSON on one line, as the MCP sends it): under the 150,000 a tool answer
// may carry (@liveworkspace/mcp-kit TOOL_RESULT_MAX_CHARS), past which the MCP refuses the answer whole instead of
// paging it. Safe range 50,000..145,000.
export const LIST_ITEMS_BUDGET = 140_000;
// The most cards a page lists, however small they are.
export const LIST_ITEMS_LIMIT_MAX = 1000;
// The longest text `query` takes: a search phrase, not a whole text.
export const LIST_ITEMS_QUERY_MAX = 200;
// The most card types or columns one filter names.
export const LIST_ITEMS_NAMES_MAX = 32;
