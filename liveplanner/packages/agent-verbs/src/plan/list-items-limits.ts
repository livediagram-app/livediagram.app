// list_items' limits (docs/specs/026-plan/blueprints/plan-agents.md "Constants and configuration"; Work Tracker 900), on
// their own so the MCP schema reads them without the Plan engine.

// The most characters an answer's text holds (JSON with two-space indents, as the MCP sends it): well under what chat
// assistants take in one tool answer. Safe range 50,000..400,000.
export const LIST_ITEMS_BUDGET = 200_000;
// The most cards a page lists, however small they are.
export const LIST_ITEMS_LIMIT_MAX = 1000;
// The longest text `query` takes: a search phrase, not a document.
export const LIST_ITEMS_QUERY_MAX = 200;
// The most card types or columns one filter names.
export const LIST_ITEMS_NAMES_MAX = 32;
