'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Brand, Tooltip } from '@livediagram/ui';
import type { TelemetryCount, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  ActivityGlyph,
  AlignGlyph,
  ArrowGlyph,
  BrushGlyph,
  CanvasGlyph,
  CheckGlyph,
  CircleGlyph,
  ClearGlyph,
  ClipboardGlyph,
  CloseGlyph,
  CloudGlyph,
  CommentGlyph,
  CopyGlyph,
  CylinderGlyph,
  DiagramGlyph,
  DiamondGlyph,
  DotGlyph,
  DownloadGlyph,
  ElementGlyph,
  EyeGlyph,
  FileGlyph,
  FitGlyph,
  FolderGlyph,
  GearGlyph,
  GroupGlyph,
  HeartGlyph,
  ImageGlyph,
  KeyboardGlyph,
  LayersGlyph,
  LinkGlyph,
  LockGlyph,
  MagnifierGlyph,
  MoonGlyph,
  MoveGlyph,
  NoteGlyph,
  OpenGlyph,
  PaletteGlyph,
  PencilGlyph,
  PersonAddGlyph,
  PersonGlyph,
  PlusGlyph,
  PointerGlyph,
  PolyGlyph,
  RectGlyph,
  RedoGlyph,
  ResetGlyph,
  RevertGlyph,
  ShareGlyph,
  SignInGlyph,
  SignOutGlyph,
  SparkGlyph,
  StarGlyph,
  StickyGlyph,
  SunGlyph,
  TabGlyph,
  TemplateGlyph,
  TextGlyph,
  ToggleGlyph,
  TrashGlyph,
  TriangleGlyph,
  UndoGlyph,
  UnlockGlyph,
  UploadGlyph,
  WindowGlyph,
  ZoomInGlyph,
  ZoomOutGlyph,
} from './glyphs';

// Same origin as the editor + api under the router (livediagram.app).
// An origin-relative '/api' is correct even though this app is served
// under '/telemetry' (basePath doesn't rewrite absolute fetch paths).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

const WINDOWS: { key: TelemetryWindowKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last month' },
];

// One-line plain-language explanation per category, shown under the
// group heading so visitors can read the dashboard cold without
// knowing the product. Kept short so the layout stays scannable.
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
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
const categoryColor = (c: string) => CATEGORY_COLORS[c] ?? '#94a3b8';

type Group = { category: string; subtotal: number; items: TelemetryCount[] };

function groupByCategory(rows: TelemetryCount[]): Group[] {
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

function eventLabel(row: TelemetryCount): string {
  return row.type ? `${row.action} · ${row.type}` : row.action;
}

// Short plain-language explanation for a single event row, shown as
// a native browser tooltip on hover so a curious visitor doesn't have
// to read the editor source to understand what each verb means. The
// rules are layered: try the most specific match first (category +
// action + type), then category + action, then category, then a
// generic action-only sentence as the safety net. The dashboard never
// surfaces a row whose strings aren't already validated against the
// closed vocabulary (spec/22), so unknown branches really are unusual.
function eventExplanation(category: string, action: string, type: string | null): string {
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
  return `One occurrence of ${eventLabel({ category, action, type, count: 0 })}.`;
}

// Dispatcher that picks a 14x14 inline SVG glyph for a row. Resolution
// order: (1) type-specific (a known shape kind, dialog target, etc.);
// (2) action-specific (Deleted -> trash regardless of category); (3)
// category fallback. Falls back to a tiny dot when nothing matches, so
// future enum additions still render something instead of throwing.
// All glyphs use `currentColor` so they inherit the row's text colour.
// Glyph lookup for an event icon, in priority order: a type-specific glyph
// (shape kinds + other recognisable types), else an action-specific one, else
// a category fallback, else a neutral dot. Tables rather than an if-ladder so
// adding an event is a one-line entry and shared glyphs read at a glance.
const TYPE_GLYPH: Record<string, () => ReactElement> = {
  Square: RectGlyph,
  Rectangle: RectGlyph,
  Circle: CircleGlyph,
  Ellipse: CircleGlyph,
  Triangle: TriangleGlyph,
  Diamond: DiamondGlyph,
  Star: StarGlyph,
  Hexagon: PolyGlyph,
  Pentagon: PolyGlyph,
  Octagon: PolyGlyph,
  Heart: HeartGlyph,
  Cloud: CloudGlyph,
  Cylinder: CylinderGlyph,
  Arrow: ArrowGlyph,
  Text: TextGlyph,
  Sticky: StickyGlyph,
  Image: ImageGlyph,
  Dark: MoonGlyph,
  Light: SunGlyph,
  Settings: GearGlyph,
  Shortcuts: KeyboardGlyph,
  Tips: SparkGlyph,
  Share: ShareGlyph,
  Activity: ActivityGlyph,
  Welcome: SparkGlyph,
  ShareLink: LinkGlyph,
  In: ZoomInGlyph,
  Out: ZoomOutGlyph,
  Fit: FitGlyph,
  Reset: ResetGlyph,
  Edit: PencilGlyph,
  View: EyeGlyph,
  JSON: FileGlyph,
  Markdown: FileGlyph,
  PDF: FileGlyph,
  PNG: FileGlyph,
  Front: LayersGlyph,
  Back: LayersGlyph,
  FormatPainter: BrushGlyph,
  Diagram: DiagramGlyph,
  Folder: FolderGlyph,
  Tab: TabGlyph,
  Element: ElementGlyph,
};
const ACTION_GLYPH: Record<string, () => ReactElement> = {
  Deleted: TrashGlyph,
  Created: PlusGlyph,
  Added: PlusGlyph,
  Duplicated: CopyGlyph,
  Locked: LockGlyph,
  Unlocked: UnlockGlyph,
  Renamed: PencilGlyph,
  Undone: UndoGlyph,
  Redone: RedoGlyph,
  Grouped: GroupGlyph,
  Ungrouped: GroupGlyph,
  Moved: MoveGlyph,
  Reverted: RevertGlyph,
  Reordered: LayersGlyph,
  Aligned: AlignGlyph,
  Cleared: ClearGlyph,
  Linked: LinkGlyph,
  Unlinked: LinkGlyph,
  Resolved: CheckGlyph,
  Unresolved: CheckGlyph,
  Searched: MagnifierGlyph,
  Selected: PointerGlyph,
  Opened: OpenGlyph,
  Closed: CloseGlyph,
  Copied: ClipboardGlyph,
  Imported: DownloadGlyph,
  Exported: UploadGlyph,
  Shared: ShareGlyph,
  Joined: PersonGlyph,
  Used: SparkGlyph,
  Changed: PencilGlyph,
  Toggled: ToggleGlyph,
  Zoomed: FitGlyph,
  SignedIn: SignInGlyph,
  SignedUp: PersonAddGlyph,
  SignedOut: SignOutGlyph,
};
const CATEGORY_GLYPH: Record<string, () => ReactElement> = {
  Diagram: DiagramGlyph,
  Element: ElementGlyph,
  Tab: TabGlyph,
  Theme: PaletteGlyph,
  Canvas: CanvasGlyph,
  Template: TemplateGlyph,
  Comment: CommentGlyph,
  Note: NoteGlyph,
  Search: MagnifierGlyph,
  UI: WindowGlyph,
  Folder: FolderGlyph,
  Session: PersonGlyph,
  Participant: PersonGlyph,
};

function EventIcon({
  category,
  action,
  type,
}: {
  category: string;
  action: string;
  type: string | null;
}) {
  const Glyph =
    TYPE_GLYPH[type ?? ''] ?? ACTION_GLYPH[action] ?? CATEGORY_GLYPH[category] ?? DotGlyph;
  return <Glyph />;
}

// ---------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------

// Window-comparison strip: three pill-shaped bars showing the totals
// for the three windows side by side. Width inside each pill scales
// by the largest of the three totals so the proportions read at
// a glance even when last-30 dwarfs today.
function WindowStrip({ today, last7, last30 }: { today: number; last7: number; last30: number }) {
  const max = Math.max(today, last7, last30, 1);
  const bars: { label: string; value: number }[] = [
    { label: 'Today', value: today },
    { label: 'Last 7 days', value: last7 },
    { label: 'Last month', value: last30 },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {bars.map((b) => (
        <div
          key={b.label}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {b.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {b.value.toLocaleString()}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.round((b.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Daily-volume sparkline: 30 vertical bars, oldest -> newest, height
// proportional to that day's total. Hover surfaces a native title
// tooltip with the date + count for each bar.
// "Month day" axis label shared by the sparklines.
function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A row of value-proportional bars (one per day) with a per-bar hover tooltip,
// shared by the daily-volume + per-category sparklines. Each caller passes its
// own container + bar styling; bars never fully vanish (2% floor).
function SparklineBars({
  days,
  values,
  containerClassName,
  barClassName,
}: {
  days: number[];
  values: number[];
  containerClassName: string;
  barClassName: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={containerClassName}>
      {values.map((v, i) => (
        <Tooltip
          key={days[i] ?? i}
          title={fmtDay(days[i] ?? 0)}
          description={`${v.toLocaleString()} events`}
          className="flex-1 items-end self-stretch"
        >
          <div className={barClassName} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
        </Tooltip>
      ))}
    </div>
  );
}

function DailySparkline({ days, totals }: { days: number[]; totals: number[] }) {
  const max = Math.max(...totals, 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Daily volume — last 30 days
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Peak {max.toLocaleString()}</p>
      </div>
      <SparklineBars
        days={days}
        values={totals}
        containerClassName="mt-4 flex h-24 items-end gap-1"
        barClassName="w-full rounded-sm bg-brand-200 transition hover:bg-brand-500 dark:bg-brand-500/40 dark:hover:bg-brand-400"
      />
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{fmtDay(days[0] ?? 0)}</span>
        <span>{fmtDay(days[days.length - 1] ?? 0)}</span>
      </div>
    </div>
  );
}

// Category share bar: one stacked horizontal bar broken into segments
// per category, with a legend underneath. Reads at a glance which
// area of the product dominates the active window's activity.
function CategoryShareBar({ groups, total }: { groups: Group[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Share of events by category
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {groups.map((g) => (
          <Tooltip
            key={g.category}
            title={g.category}
            description={`${((g.subtotal / total) * 100).toFixed(1)}% of events`}
            className="h-full"
            style={{ width: `${(g.subtotal / total) * 100}%` }}
          >
            <div className="h-full w-full" style={{ backgroundColor: categoryColor(g.category) }} />
          </Tooltip>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {groups.map((g) => (
          <li key={g.category} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: categoryColor(g.category) }}
            />
            <span>{g.category}</span>
            <span className="text-slate-400">{((g.subtotal / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Top-N leaderboard: highest-count events across all categories.
// Each row is icon + label + a relative bar + count, sorted desc.
function TopNLeaderboard({ rows, n = 10 }: { rows: TelemetryCount[]; n?: number }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, n);
  if (sorted.length === 0) return null;
  const top = sorted[0]?.count ?? 1;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Top {sorted.length} events
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((row) => (
          <Tooltip
            key={`${row.category}:${row.action}:${row.type ?? ''}`}
            title={`${row.category} · ${eventLabel(row)}`}
            description={eventExplanation(row.category, row.action, row.type ?? null)}
            block
          >
            <li className="flex w-full items-center gap-2 text-sm">
              <span className="shrink-0 text-slate-400">
                <EventIcon category={row.category} action={row.action} type={row.type ?? null} />
              </span>
              <span className="w-32 shrink-0 truncate text-slate-600">
                {row.category} · {eventLabel(row)}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(row.count / top) * 100}%`,
                    backgroundColor: categoryColor(row.category),
                  }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-medium text-slate-900">
                {row.count.toLocaleString()}
              </span>
            </li>
          </Tooltip>
        ))}
      </ul>
    </div>
  );
}

// Per-category sparkline rendered inside each category card so a
// reader can see "is this category trending up?" without scrolling
// back to the global daily-volume chart. 30 bars, scaled to the
// category's own peak (not the global peak) so a quiet category
// isn't a flat line beneath a dominant one.
function CategorySparkline({ days, series }: { days: number[]; series: number[] }) {
  if (series.length === 0) return null;
  return (
    <SparklineBars
      days={days}
      values={series}
      containerClassName="mt-3 flex h-10 items-end gap-[2px]"
      barClassName="w-full rounded-[1px] bg-slate-200 dark:bg-slate-700"
    />
  );
}

export default function TelemetryDashboard() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [active, setActive] = useState<TelemetryWindowKey>('last7');
  // Category accordions: closed by default so a fresh visitor scans
  // categories first and drills into the one they're curious about.
  // Keyed by category name so the state survives a window switch.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCategory = (category: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/telemetry/summary`)
      .then((r) => (r.ok ? (r.json() as Promise<TelemetrySummary>) : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const window = summary?.enabled ? summary.windows[active] : null;
  const groups = useMemo(() => groupByCategory(window?.rows ?? []), [window]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <div className="flex items-center justify-between gap-4">
        <Brand href="/" size="md" />
        <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to livediagram
        </a>
      </div>

      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Telemetry, in the open
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
        This is everything we measure. We record anonymous, first-party product events to learn
        which features actually help. There are no third-party analytics or tracking vendors, no
        user content (never a diagram name, your name, or anything you type), and the data is never
        sold or shared beyond this page.
      </p>

      {status === 'loading' ? (
        <p className="mt-12 text-slate-500">Loading…</p>
      ) : status === 'error' ? (
        <p className="mt-12 text-slate-500">Couldn&rsquo;t load the numbers right now.</p>
      ) : !summary?.enabled ? (
        <div className="mt-12 rounded-lg border border-slate-200 bg-white p-6">
          <p className="font-medium text-slate-900">Telemetry isn&rsquo;t enabled here.</p>
          <p className="mt-1 text-sm text-slate-600">
            This deployment hasn&rsquo;t turned telemetry on, so there&rsquo;s nothing to show.
          </p>
        </div>
      ) : (
        <>
          {/* Fixed timeframes only (Today / Last 7 days / Last month) so
              the queries stay simple and cacheable (spec/22). */}
          <div className="mt-10 inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setActive(w.key)}
                className={
                  'rounded-md px-4 py-1.5 text-sm font-medium transition ' +
                  (active === w.key
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100')
                }
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Window-comparison strip: read all three windows at once
              without flipping the toggle. Replaces the standalone
              "Total events" headline above — that number is one of
              the three cards here. */}
          <div className="mt-8">
            <WindowStrip
              today={summary.windows.today.total}
              last7={summary.windows.last7.total}
              last30={summary.windows.last30.total}
            />
          </div>

          {/* Daily volume across the last 30 days. Driven by the
              `daily` field the api now serves; absent means an older
              api revision and the chart is skipped. */}
          {summary.daily ? (
            <div className="mt-6">
              <DailySparkline days={summary.daily.days} totals={summary.daily.totals} />
            </div>
          ) : null}

          {/* Category-share stacked bar + top-N leaderboard. Side by
              side on wide screens. */}
          {window && window.total > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <CategoryShareBar groups={groups} total={window.total} />
              <TopNLeaderboard rows={window.rows} />
            </div>
          ) : null}

          {groups.length === 0 ? (
            <p className="mt-8 text-slate-500">No events recorded in this window yet.</p>
          ) : (
            // CSS multi-column layout instead of a grid: grid rows
            // would either (a) stretch a collapsed card to match the
            // tallest expanded sibling, or (b) leave a big vertical
            // gap underneath a closed card when its row-mate was
            // expanded. Columns flow card-by-card top-to-bottom then
            // wrap to the next column, packing tightly regardless of
            // which accordions happen to be open. `break-inside-avoid`
            // keeps each card whole when it crosses a column.
            <div className="mt-8 columns-1 gap-6 sm:columns-2">
              {groups.map((group) => {
                const isOpen = expanded.has(group.category);
                return (
                  <div
                    key={group.category}
                    className="mb-6 break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-baseline justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                      <span className="flex items-baseline gap-2">
                        <span
                          aria-hidden
                          className={
                            'inline-block text-xs text-slate-400 transition-transform ' +
                            (isOpen ? 'rotate-90' : '')
                          }
                        >
                          ▶
                        </span>
                        <h2 className="text-base font-semibold text-slate-900">{group.category}</h2>
                      </span>
                      <span className="text-sm font-medium text-slate-400">
                        {group.subtotal.toLocaleString()}
                      </span>
                    </button>
                    {/* Grid-template-rows animation so the body slides
                        open/closed rather than popping. Mirrors the
                        MovablePanel pattern in the editor. */}
                    <div
                      className={
                        'grid transition-[grid-template-rows] duration-200 ease-out ' +
                        (isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
                      }
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-5">
                          {CATEGORY_DESCRIPTIONS[group.category] ? (
                            <p className="text-xs leading-relaxed text-slate-500">
                              {CATEGORY_DESCRIPTIONS[group.category]}
                            </p>
                          ) : null}
                          {/* Per-category sparkline: last 30 days of
                              this category's daily count, scaled to
                              its own peak so a quiet category still
                              shows a useful shape. */}
                          {summary.daily && summary.daily.byCategory[group.category] ? (
                            <CategorySparkline
                              days={summary.daily.days}
                              series={summary.daily.byCategory[group.category]!}
                            />
                          ) : null}
                          <ul className="mt-3 divide-y divide-slate-100">
                            {group.items.map((row) => {
                              const share = group.subtotal > 0 ? row.count / group.subtotal : 0;
                              return (
                                <Tooltip
                                  key={`${row.action}:${row.type ?? ''}`}
                                  title={eventLabel(row)}
                                  description={eventExplanation(
                                    row.category,
                                    row.action,
                                    row.type ?? null,
                                  )}
                                  block
                                >
                                  <li className="block w-full py-1.5 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="flex min-w-0 flex-1 items-center gap-2 text-slate-600">
                                        <span className="shrink-0 text-slate-400">
                                          <EventIcon
                                            category={row.category}
                                            action={row.action}
                                            type={row.type ?? null}
                                          />
                                        </span>
                                        <span className="truncate">{eventLabel(row)}</span>
                                      </span>
                                      <span className="font-medium text-slate-900">
                                        {row.count.toLocaleString()}
                                      </span>
                                    </div>
                                    {/* Inline share bar: row's share of
                                        the category's subtotal. Same
                                        data the count above carries,
                                        visualised so the dominant rows
                                        stand out without scanning the
                                        numbers. */}
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${share * 100}%`,
                                          backgroundColor: categoryColor(group.category),
                                        }}
                                      />
                                    </div>
                                  </li>
                                </Tooltip>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {summary.generatedAt ? (
            <p className="mt-10 text-xs text-slate-400">
              Anonymous, first-party, no vendors. Updated a few minutes at a time.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
