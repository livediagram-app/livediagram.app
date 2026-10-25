// Plain-language vocabulary + grouping helpers for the telemetry
// dashboard. Extracted from the page shell so the metric cards and the
// Search view share one definition of what each event means, what
// colour a category gets, and how rows roll up into category groups.
// (The closed event vocabulary itself lives in docs/specs/017-telemetry/telemetry.md + the api-schema
// enums; this module only turns it into human-readable strings.)

import { type TelemetryCount } from '@liveworkspace/telemetry';
import { titleCase } from '@livediagram/api-schema';
import type { Appearance } from '@livediagram/ui';
import { forAppearance } from './appearance-colours';

// Per-category colour used by every chart so the category-share bar,
// per-category sparkline, and category-card legend dot all agree. Each app
// hand-picks its own (its config's `categoryColors`, keyed by the app's full
// TelemetryCategory union so a new category fails the typecheck until it gets
// a colour), so adjacent slices in the stacked bar stay visually distinct.
// Stray strings fall back to slate. In dark it hands back the hue lifted to
// read on the dark card (appearance-colours).
export type CategoryColors = Readonly<Record<string, string>>;

export const CATEGORY_FALLBACK = '#94a3b8';

export const categoryColor = (
  colors: CategoryColors,
  c: string,
  appearance: Appearance = 'light',
) => forAppearance(colors[c] ?? CATEGORY_FALLBACK, appearance);

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
  // 'SessionButton' -> 'Session Button', 'AiOn' -> 'AI On', 'Speech-bubble' -> 'Speech Bubble'.
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
