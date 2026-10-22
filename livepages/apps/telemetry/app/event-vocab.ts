// Plain-language vocabulary + grouping helpers for the telemetry
// dashboard. Extracted from the page shell so the metric cards and the
// Search view share one definition of what each event means, what
// colour a category gets, and how rows roll up into category groups.
// (The closed event vocabulary itself lives in docs/specs/017-telemetry/telemetry.md + the api-schema
// enums; this module only turns it into human-readable strings.)

import { titleCase, type TelemetryCategory, type TelemetryCount } from '@livepages/api-schema';
import type { Appearance } from '@livepages/ui';
import { forAppearance } from './appearance-colours';

// Per-category colour used by every chart so the category-share bar,
// per-category sparkline, and category-card legend dot all agree. Hand-
// picked so adjacent slices in the stacked bar stay visually distinct
// (no two adjacent blues). Keyed by the full TelemetryCategory union so a
// new category fails the typecheck until it gets its own colour; the
// `categoryColor` accessor keeps a slate fallback for stray strings. In dark
// it hands back the hue lifted to read on the dark card (appearance-colours).
const CATEGORY_COLORS: Record<TelemetryCategory, string> = {
  Document: '#0ea5e9',
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
  // Deep green, the funnel's colour: apart from Element's emerald and the
  // lime of Comment and Action.
  Cta: '#15803d',
  // Distinct from Document's sky (#0ea5e9) and Session's slate: the
  // Timeline sits next to both in the stacked bar.
  Timeline: '#0369a1',
  // Indigo-violet: the landing view, apart from the Timeline's deep sky and Activity's amber.
  Home: '#4f46e5',
  // Amber, so the inbox reads apart from the Timeline's deep sky beside it.
  Activity: '#d97706',
  Token: '#d946ef',
  // Warm stone: a quiet backstop, apart from Document's sky and Error's red.
  Trash: '#78716c',
  // Deep brown: apart from the greens (Action, Element, Cta), Email's teal and
  // Activity's amber.
  Drive: '#854d0e',
  Mcp: '#f43f5e',
  // Terminal ink: the command line, darker than the stone greys of Trash and Draw.
  Cli: '#1e293b',
  // Burnt orange: the agents' changesets, apart from MCP's rose and Activity's amber.
  Agent: '#c2410c',
  Plan: '#2563eb',
  // Green, the spreadsheet's own.
  Sheet: '#16a34a',
  // Violet, the Event RSVP starter's: apart from Plan's blue and Sheet's green.
  Form: '#7c3aed',
  // Pink, the heart on a Community card.
  Community: '#db2777',
  Email: '#0d9488',
  Error: '#dc2626',
  // Warm stone, the marker on a whiteboard: apart from every blue and green.
  Draw: '#78716c',
  // Deep violet: the mode switch, apart from Draw's stone beside it.
  Editor: '#6d28d9',
  // Deep cyan: the Explorer's filters, apart from UI's lighter cyan and Search's indigo.
  Explorer: '#155e75',
  // Deep teal-green, a stopwatch: apart from Email's teal and Cta's green.
  Timing: '#047857',
};
export const categoryColor = (c: string, appearance: Appearance = 'light') =>
  forAppearance(CATEGORY_COLORS[c as TelemetryCategory] ?? '#94a3b8', appearance);

// Re-exported from the shared api-schema helper so the dashboard's
// existing `./event-vocab` import surface (MetricPicker, RankCard) keeps
// resolving; one definition now backs both this app and the editor.
export { titleCase };

// How a `type` reads on screen. Tokens are title-cased ('square' ->
// 'Square'); a page path (docs/specs/017-telemetry/page-view-telemetry.md) is shown exactly as stored, since
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
