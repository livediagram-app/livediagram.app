// Plain-language vocabulary + grouping helpers for the telemetry
// dashboard. Extracted from the page shell so the metric cards and the
// Search view share one definition of what each event means, what
// colour a category gets, and how rows roll up into category groups.
// (The closed event vocabulary itself lives in spec/22 + the api-schema
// enums; this module only turns it into human-readable strings.)

import { titleCase, type TelemetryCategory, type TelemetryCount } from '@livediagram/api-schema';

// One-line plain-language explanation per category, shown under the
// group heading so visitors can read the dashboard cold without
// knowing the product. Kept short so the layout stays scannable. Keyed by
// the full TelemetryCategory union so a new category fails the typecheck
// here until it gets a description (the lookup still tolerates stray
// strings via the `?? fallback` at the call site).
export const CATEGORY_DESCRIPTIONS: Record<TelemetryCategory, string> = {
  Diagram:
    'Whole-diagram lifecycle: opening, creating, sharing, joining, exporting, undo/redo, moving between folders.',
  Element:
    'Things on the canvas: shapes, text, stickies, arrows, images. Add, delete, group, link, layer order.',
  Tab: 'Per-tab actions: open, create, rename, reorder, lock, import JSON, clear content, auto-align.',
  Theme: 'Diagram theme switches (the canvas-content palette: brand, slate, mint, etc.).',
  Canvas: 'Canvas background pattern changes and zoom controls (in, out, fit, reset).',
  Template: 'Template scaffolds picked when starting a new diagram or seeding a fresh tab.',
  Comment: 'Per-element comment threads: add, delete, resolve, reopen, open the popover.',
  Note: 'Per-element notes (a single paragraph, no thread): add, edit, delete, open the popover.',
  Action:
    'Per-element assigned actions: assigning (with or without the email nudge), completing, reopening, editing / reassigning, deleting, opening the popover.',
  Search: 'Global search panel: open, query, picked-result kind.',
  UI: 'Editor chrome: light/dark toggle, dialogs (Settings, Shortcuts, Share, Activity), share-link copy, welcome dismiss.',
  Folder:
    'Folders: create, rename, delete, re-parent. Explorer folders of diagrams, or (type Tab) tab folders inside one diagram.',
  Layer:
    'Tab layers (Photoshop-style stacking bands): add, rename, delete, restack, show / hide, lock, move elements between layers, open the panel.',
  Session: 'Accounts, where sign-in is set up: signing up, signing in, signing out.',
  Facilitator:
    'The live-session baton: somebody taking the timer / votes / polls for a room, handing them on, or stepping down.',
  AI: 'The optional in-editor AI assistant: running its Ask / Clean requests on the current tab.',
  Team: 'Teams: creating and joining, renaming, role changes, member invites and removals, and the shared team library of diagrams.',
  Participant:
    'Visitor arrivals: a first-time visitor (once per new browser), and a returning browser reopening the app (once per day, split guest vs signed-in).',
  Help: 'Help-centre articles: views and per-article helpful / not-really feedback.',
  Page: 'Pages viewed across the whole site (marketing, editor, help centre, this dashboard), by path, with ids and query strings stripped.',
  Timeline:
    "The Explorer's activity feed: opening it (split by whether it was the landing view or a deliberate visit), switching between the list and calendar views, toggling a filter chip, expanding a collapsed run of same-day events, and paging further back.",
  Activity:
    "The Explorer's Activity page (open actions and comment threads across every diagram): opening it, clicking a row through to the diagram (split by action vs thread), and retrying a failed read.",
  Token: 'API tokens: created by hand or by an AI tool connecting over MCP, and revoked.',
  Mcp: 'MCP server tool calls made by connected AI assistants.',
  Email:
    'Emails the product sends (welcome, onboarding, team invites, notifications). Which email only, never who received it.',
  Error:
    'Failures, counted generically: API responses that errored (by HTTP status, plus worker-reported internal crashes) client-side uncaught exceptions, and warnings (a degradation the author was carried through, such as a spent AI budget failing over to the in-browser reader). Never a message, stack, or URL.',
};

// Per-category colour used by every chart so the category-share bar,
// per-category sparkline, and category-card legend dot all agree. Hand-
// picked so adjacent slices in the stacked bar stay visually distinct
// (no two adjacent blues). Keyed by the full TelemetryCategory union so a
// new category fails the typecheck until it gets its own colour; the
// `categoryColor` accessor keeps a slate fallback for stray strings.
const CATEGORY_COLORS: Record<TelemetryCategory, string> = {
  Diagram: '#0ea5e9',
  Element: '#10b981',
  Tab: '#f59e0b',
  Theme: '#8b5cf6',
  Canvas: '#ec4899',
  Template: '#06b6d4',
  Comment: '#84cc16',
  Note: '#f97316',
  Action: '#65a30d',
  Search: '#6366f1',
  UI: '#0891b2',
  Folder: '#a855f7',
  Layer: '#7c3aed',
  Session: '#64748b',
  Facilitator: '#a855f7',
  AI: '#eab308',
  Team: '#2563eb',
  Participant: '#dc2626',
  Help: '#14b8a6',
  // Deep pink: apart from Canvas's lighter pink and every blue it sits near.
  Page: '#9d174d',
  // Distinct from Diagram's sky (#0ea5e9) and Session's slate: the
  // Timeline sits next to both in the stacked bar.
  Timeline: '#0369a1',
  // Amber, so the inbox reads apart from the Timeline's deep sky beside it.
  Activity: '#d97706',
  Token: '#d946ef',
  Mcp: '#f43f5e',
  Email: '#0d9488',
  Error: '#dc2626',
};
export const categoryColor = (c: string) => CATEGORY_COLORS[c as TelemetryCategory] ?? '#94a3b8';

// Re-exported from the shared api-schema helper so the dashboard's
// existing `./event-vocab` import surface (MetricPicker, RankCard) keeps
// resolving; one definition now backs both this app and the editor.
export { titleCase };

// How a `type` reads on screen. Tokens are title-cased ('square' ->
// 'Square'); a page path (spec/150) is shown exactly as stored, since
// '/help/the-canvas' is only recognisable as the URL it is.
// Canvas·Changed types that are a canvas-panel control rather than a
// background pattern (useTabCanvas's debounced emits), with the words for it.
// The Look & Feel Canvas Styles ranking is patterns only, so it leaves these
// out; their explanation copy says what they are instead of calling them a pattern.
export const CANVAS_CONTROLS: Readonly<Record<string, string>> = {
  BackgroundColor: 'background colour',
  BackgroundOpacity: 'background opacity',
  PatternColor: 'pattern colour',
  BackgroundPatternScale: 'pattern scale',
  BackgroundAnimationSpeed: 'background animation speed',
};

export function typeLabel(type: string): string {
  // Page paths and error codes (`Http403.SaveTab`) are only recognisable as
  // what was recorded, so they stay as they are.
  if (type.startsWith('/') || type.includes('.')) return type;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(type)) return articleTitle(type);
  // 'SessionButton' -> 'Session Button', 'AiOn' -> 'AI On', 'Idea-box' -> 'Idea Box'.
  return type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const ACRONYMS: Readonly<Record<string, string>> = {
  ai: 'AI',
  api: 'API',
  faq: 'FAQ',
  id: 'ID',
  json: 'JSON',
  mcp: 'MCP',
  pdf: 'PDF',
  png: 'PNG',
  svg: 'SVG',
  ui: 'UI',
  url: 'URL',
};
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

// A help article's telemetry id is its slug: 'api-tokens' -> 'API Tokens',
// 'your-first-diagram' -> 'Your First Diagram'.
export function articleTitle(slug: string): string {
  return slug
    .split('-')
    .map(
      (w, i) =>
        ACRONYMS[w] ?? (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)),
    )
    .join(' ');
}

export function eventLabel(row: Pick<TelemetryCount, 'action' | 'type'>): string {
  return row.type ? `${titleCase(row.action)} · ${typeLabel(row.type)}` : titleCase(row.action);
}
