// The shape of a Dashboard tab's layout (dashboard.ts): its limits, its rows and slots, and the small builders a new
// row or a new Dashboard starts from. Kept apart so the readers and the edits (dashboard-edit.ts) share one source.

import type { DashboardCardContent } from './dashboard-cards';
import type { DashboardCardStyle } from './dashboard-card-style';
export const DASHBOARD_ROWS_MAX = 12;
export const DASHBOARD_SLOTS_MAX = 4;
// A row's width in spans, and the narrowest a slot may be.
export const DASHBOARD_SPANS = 12;
export const DASHBOARD_SPAN_MIN = 2;
// The gap between a row's slots, and between rows, in px (DashboardRowView draws it; an image export lays out by it).
export const DASHBOARD_GAP_PX = 12;
export const DASHBOARD_ROW_H_MIN = 120;
export const DASHBOARD_ROW_H_MAX = 1200;
export const DASHBOARD_ROW_H_DEFAULT = 320;
// A note's text, and its heading.
export const DASHBOARD_NOTE_MAX = 2000;
export const DASHBOARD_NOTE_TITLE_MAX = 120;

export type DashboardContent =
  // A Board or Sheet tab of the project, drawn compact and live.
  // `of`: which it is, so a slot whose tab was deleted can still say what was lost (a Board when absent).
  | { type: 'tab'; tabId: string; of?: DashboardTabOf }
  // An element on the dashboard tab: a plan view (visualisation or metric) or a chart from a Sheet.
  // `name`: the slot's own name in place of the view's generated heading (slot-name.ts).
  | { type: 'element'; elementId: string; name?: string }
  | { type: 'note'; title: string; text: string; style?: DashboardCardStyle }
  // A section's title: a big heading over a line or two of description, drawn bare on the page.
  | { type: 'title'; title: string; text: string; style?: DashboardCardStyle }
  // A Status, Checklist, Key Date or Links (dashboard-cards.ts).
  | DashboardCardContent;

// What kind of tab a slot shows: a Board or Sheet tab, worked on in place. No other kind of tab goes in a slot.
export type DashboardTabOf = 'board' | 'sheet';

export type DashboardSlot = { id: string; span: number; content?: DashboardContent };
// `fill`: the row takes the page's height (a full-screen visualisation, docs/specs/026-plan/plan-tabs.md "A row that
// fills the page"); its `height` is kept for when it stops filling.
export type DashboardRow = { id: string; height: number; slots: DashboardSlot[]; fill?: true };
// `background`: the page behind the slots (docs/specs/026-plan/plan-tabs.md "Dashboard Settings"): plain (absent)
// or a soft tint of the theme's brand.
export const DASHBOARD_BACKGROUNDS = ['plain', 'tint'] as const;
export type DashboardBackground = (typeof DASHBOARD_BACKGROUNDS)[number];
export type DashboardLayout = { rows: DashboardRow[]; background?: 'tint' };

export type IdMaker = () => string;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Spans for `n` slots across a row: as even as twelfths allow, the remainder to the first slots.
export function evenSpans(n: number): number[] {
  const count = clamp(Math.round(n), 1, DASHBOARD_SLOTS_MAX);
  const base = Math.floor(DASHBOARD_SPANS / count);
  const extra = DASHBOARD_SPANS - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

// Rows of `items`, `per` to a row, each slot the row's share of twelfths (the remainder to the last), each item's
// content from `content`; rows and slots without ids, for a builder that ids them later (a template, a conversion).
export function dashboardRowsOf<T>(
  items: readonly T[],
  per: number,
  height: number,
  content: (t: T) => DashboardContent,
): { height: number; slots: { span: number; content: DashboardContent }[] }[] {
  const out: { height: number; slots: { span: number; content: DashboardContent }[] }[] = [];
  for (let i = 0; i < items.length; i += per) {
    const chunk = items.slice(i, i + per);
    const span = Math.floor(DASHBOARD_SPANS / chunk.length);
    out.push({
      height,
      slots: chunk.map((t, k) => ({
        span: k === chunk.length - 1 ? DASHBOARD_SPANS - span * (chunk.length - 1) : span,
        content: content(t),
      })),
    });
  }
  return out;
}

export function newRow(id: IdMaker, slots = 2): DashboardRow {
  return {
    id: id(),
    height: DASHBOARD_ROW_H_DEFAULT,
    slots: evenSpans(slots).map((span) => ({ id: id(), span })),
  };
}

// A new Dashboard: two rows of two empty slots.
export function newDashboard(id: IdMaker): DashboardLayout {
  return { rows: [newRow(id), newRow(id)] };
}
