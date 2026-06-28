// Plain-language vocabulary + grouping helpers for the telemetry
// dashboard. Extracted from the page shell so the Raw breakdown and the
// Search view share one definition of what each event means, what
// colour a category gets, and how rows roll up into category groups.
// (The closed event vocabulary itself lives in spec/22 + the api-schema
// enums; this module only turns it into human-readable strings.)

import type { TelemetryCount } from '@livediagram/api-schema';

// One-line plain-language explanation per category, shown under the
// group heading so visitors can read the dashboard cold without
// knowing the product. Kept short so the layout stays scannable.
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Diagram:
    'Whole-diagram lifecycle: creating, sharing, joining, exporting, undo/redo, moving between folders.',
  Element:
    'Things on the canvas: shapes, text, stickies, arrows, images. Add, delete, group, link, layer order.',
  Tab: 'Per-tab actions: create, rename, reorder, lock, import JSON, clear content, auto-align.',
  Theme: 'Diagram theme switches (the canvas-content palette: brand, slate, mint, etc.).',
  Canvas: 'Canvas background pattern changes and zoom controls (in, out, fit, reset).',
  Template: 'Template scaffolds picked when starting a new diagram or seeding a fresh tab.',
  Comment: 'Per-element comment threads: add, delete, resolve, reopen, open the popover.',
  Note: 'Per-element notes (a single paragraph, no thread): add, edit, delete, open the popover.',
  Search: 'Global search panel: open, query, picked-result kind.',
  UI: 'Editor chrome: light/dark toggle, dialogs (Settings, Shortcuts, Share, Activity), share-link copy, welcome dismiss.',
  Folder: 'Diagram folders: create, rename, delete, re-parent.',
  Session: 'Account-level events when Clerk auth is configured: sign-in, sign-up, sign-out.',
};

// Per-category colour used by every chart so the category-share bar,
// per-category sparkline, and category-card legend dot all agree. Hand-
// picked so adjacent slices in the stacked bar stay visually distinct
// (no two adjacent blues). Any future category falls back to a slate.
const CATEGORY_COLORS: Record<string, string> = {
  Diagram: '#0ea5e9',
  Element: '#10b981',
  Tab: '#f59e0b',
  Theme: '#8b5cf6',
  Canvas: '#ec4899',
  Template: '#06b6d4',
  Comment: '#84cc16',
  Note: '#f97316',
  Search: '#6366f1',
  UI: '#0891b2',
  Folder: '#a855f7',
  Session: '#64748b',
};
export const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? '#94a3b8';

export type Group = { category: string; subtotal: number; items: TelemetryCount[] };

export function groupByCategory(rows: TelemetryCount[]): Group[] {
  const map = new Map<string, TelemetryCount[]>();
  for (const row of rows) {
    const arr = map.get(row.category) ?? [];
    arr.push(row);
    map.set(row.category, arr);
  }
  return [...map.entries()]
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => b.count - a.count),
      subtotal: items.reduce((sum, i) => sum + i.count, 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

export function eventLabel(row: Pick<TelemetryCount, 'action' | 'type'>): string {
  return row.type ? `${row.action} · ${row.type}` : row.action;
}

// Short plain-language explanation for a single event row, shown as
// a tooltip on hover so a curious visitor doesn't have to read the
// editor source to understand what each verb means. The rules are
// layered: try the most specific match first (category + action +
// type), then category + action, then category, then a generic
// action-only sentence as the safety net. The dashboard never surfaces
// a row whose strings aren't already validated against the closed
// vocabulary (spec/22), so unknown branches really are unusual.
export function eventExplanation(category: string, action: string, type: string | null): string {
  // Category + action + type (the most user-recognisable combos).
  if (category === 'Element' && action === 'Added' && type) {
    return `Someone dropped a ${type.toLowerCase()} onto the canvas.`;
  }
  if (category === 'Diagram' && action === 'Exported' && type) {
    return `Someone exported a tab as ${type}.`;
  }
  if (category === 'Diagram' && action === 'Shared' && type) {
    return `Someone generated a ${type.toLowerCase()}-role share link for a diagram.`;
  }
  if (category === 'Diagram' && action === 'Joined' && type) {
    return `Someone opened a diagram via a ${type.toLowerCase()}-role share link.`;
  }
  if (category === 'Element' && action === 'Linked' && type) {
    return `Someone linked an element to another ${type.toLowerCase()}.`;
  }
  if (category === 'Element' && action === 'Reordered' && type) {
    return type === 'Front'
      ? 'Someone sent an element to the front of the stack.'
      : 'Someone sent an element to the back of the stack.';
  }
  if (category === 'Element' && action === 'Changed' && type === 'FormatPainter') {
    return 'Someone used the format painter to copy a style from one element onto another.';
  }
  if (category === 'Tab' && action === 'Imported' && type) {
    return `Someone imported a tab from a ${type} file.`;
  }
  if (category === 'Theme' && action === 'Changed' && type) {
    return `Someone switched a tab to the ${type} theme.`;
  }
  if (category === 'Canvas' && action === 'Changed' && type) {
    return `Someone switched a tab's background pattern to ${type}.`;
  }
  if (category === 'Canvas' && action === 'Zoomed' && type) {
    if (type === 'In') return 'Someone tapped the zoom-in button.';
    if (type === 'Out') return 'Someone tapped the zoom-out button.';
    if (type === 'Fit') return 'Someone tapped "Fit to screen".';
    if (type === 'Reset') return 'Someone reset the zoom to 100%.';
  }
  if (category === 'Template' && action === 'Used' && type) {
    return `Someone started a fresh tab from the ${type} template.`;
  }
  if (category === 'Search' && action === 'Selected' && type) {
    return `Someone picked a ${type.toLowerCase()} match from the global search results.`;
  }
  if (category === 'UI' && action === 'Toggled' && type) {
    return `Someone switched the editor chrome to ${type.toLowerCase()} mode.`;
  }
  if (category === 'UI' && action === 'Opened' && type) {
    if (type === 'Settings') return 'Someone opened the Settings dialog.';
    if (type === 'Shortcuts') return 'Someone opened the keyboard-shortcuts dialog.';
    if (type === 'Tips') return 'Someone opened the Tips carousel.';
    if (type === 'Share') return 'Someone opened the Share dialog.';
    if (type === 'Activity') return 'Someone expanded the Activity panel.';
  }
  if (category === 'UI' && action === 'Closed' && type === 'Welcome') {
    return 'Someone dismissed the first-run welcome modal.';
  }
  if (category === 'UI' && action === 'Copied' && type === 'ShareLink') {
    return 'Someone copied a share link to the clipboard.';
  }

  // Category + action.
  if (category === 'Diagram') {
    if (action === 'Created') return 'A brand-new diagram was created.';
    if (action === 'Duplicated') return 'A diagram was duplicated into a new one.';
    if (action === 'Deleted') return 'A diagram was deleted.';
    if (action === 'Renamed') return 'A diagram was renamed.';
    if (action === 'Moved') return 'A diagram was moved into (or out of) a folder.';
    if (action === 'Undone') return 'Someone hit Undo on a diagram edit.';
    if (action === 'Redone') return 'Someone hit Redo on a diagram edit.';
    if (action === 'Reverted')
      return 'Someone reverted a single change from the diagram activity log.';
  }
  if (category === 'Element') {
    if (action === 'Deleted') return 'An element was removed from the canvas.';
    if (action === 'Duplicated') return 'An element was duplicated.';
    if (action === 'Grouped') return 'A multi-selection was grouped.';
    if (action === 'Ungrouped') return 'A group was disbanded back into individual elements.';
    if (action === 'Locked') return "An element's lock was turned on (no edits allowed).";
    if (action === 'Unlocked') return "An element's lock was turned off (edits resume).";
    if (action === 'Unlinked') return 'Someone cleared the link off an element.';
  }
  if (category === 'Tab') {
    if (action === 'Created') return 'A new tab was added to a diagram.';
    if (action === 'Deleted') return 'A tab was removed from a diagram.';
    if (action === 'Duplicated') return 'A tab was duplicated.';
    if (action === 'Renamed') return 'A tab was renamed.';
    if (action === 'Locked') return 'A tab was locked (read-only).';
    if (action === 'Unlocked') return 'A tab was unlocked (edits resume).';
    if (action === 'Linked') return 'A tab was linked into another diagram.';
    if (action === 'Reordered') return 'Someone dragged a tab to a new position.';
    if (action === 'Aligned') return 'Someone tapped "Auto align" to snap a tab to the grid.';
    if (action === 'Cleared') return "A tab's content was wiped.";
  }
  if (category === 'Comment') {
    if (action === 'Added') return 'A comment was added to an element thread.';
    if (action === 'Deleted') return 'A comment was removed from a thread.';
    if (action === 'Resolved') return 'A comment thread was marked resolved.';
    if (action === 'Unresolved') return 'A resolved comment thread was reopened.';
    if (action === 'Opened') return 'Someone opened the comment popover on an element.';
  }
  if (category === 'Note') {
    if (action === 'Added') return 'A note was added to an element (first non-empty save).';
    if (action === 'Changed') return "An existing note's text was edited.";
    if (action === 'Deleted') return 'A note was cleared from an element.';
    if (action === 'Opened') return 'Someone opened the note popover on an element.';
  }
  if (category === 'Search') {
    if (action === 'Opened') return 'The global search panel was opened.';
    if (action === 'Searched') return 'A query was typed into search (one emit per session).';
  }
  if (category === 'Folder') {
    if (action === 'Created') return 'A new folder was created in the diagram explorer.';
    if (action === 'Renamed') return 'A folder was renamed.';
    if (action === 'Deleted') return 'A folder was deleted (contained diagrams move to Unsorted).';
    if (action === 'Moved') return 'A folder was re-parented under another folder (or the root).';
  }
  if (category === 'Session') {
    if (action === 'SignedIn') return 'A visitor just completed sign-in via Clerk.';
    if (action === 'SignedUp') return 'A visitor just completed sign-up via Clerk.';
    if (action === 'SignedOut') return 'A visitor just signed out.';
  }
  if (category === 'Participant') {
    if (action === 'Created')
      return 'A brand-new browser identity was minted: a first-time visitor.';
  }

  // Generic fallback.
  return `One occurrence of ${eventLabel({ action, type })}.`;
}
