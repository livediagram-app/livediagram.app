'use client';

import { useEffect, useMemo, useState } from 'react';
import { Brand } from '@livediagram/ui';
import type { TelemetryCount, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';

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

  // Generic fallback.
  return `One occurrence of ${eventLabel({ category, action, type, count: 0 })}.`;
}

// Dispatcher that picks a 14x14 inline SVG glyph for a row. Resolution
// order: (1) type-specific (a known shape kind, dialog target, etc.);
// (2) action-specific (Deleted -> trash regardless of category); (3)
// category fallback. Falls back to a tiny dot when nothing matches, so
// future enum additions still render something instead of throwing.
// All glyphs use `currentColor` so they inherit the row's text colour.
function EventIcon({
  category,
  action,
  type,
}: {
  category: string;
  action: string;
  type: string | null;
}) {
  const t = type ?? '';
  // Shape kinds and other type-specific glyphs first.
  if (t === 'Square' || t === 'Rectangle') return <RectGlyph />;
  if (t === 'Circle' || t === 'Ellipse') return <CircleGlyph />;
  if (t === 'Triangle') return <TriangleGlyph />;
  if (t === 'Diamond') return <DiamondGlyph />;
  if (t === 'Star') return <StarGlyph />;
  if (t === 'Hexagon' || t === 'Pentagon' || t === 'Octagon') return <PolyGlyph />;
  if (t === 'Heart') return <HeartGlyph />;
  if (t === 'Cloud') return <CloudGlyph />;
  if (t === 'Cylinder') return <CylinderGlyph />;
  if (t === 'Arrow') return <ArrowGlyph />;
  if (t === 'Text') return <TextGlyph />;
  if (t === 'Sticky') return <StickyGlyph />;
  if (t === 'Image') return <ImageGlyph />;
  if (t === 'Dark') return <MoonGlyph />;
  if (t === 'Light') return <SunGlyph />;
  if (t === 'Settings') return <GearGlyph />;
  if (t === 'Shortcuts') return <KeyboardGlyph />;
  if (t === 'Share') return <ShareGlyph />;
  if (t === 'Activity') return <ActivityGlyph />;
  if (t === 'Welcome') return <SparkGlyph />;
  if (t === 'ShareLink') return <LinkGlyph />;
  if (t === 'In') return <ZoomInGlyph />;
  if (t === 'Out') return <ZoomOutGlyph />;
  if (t === 'Fit') return <FitGlyph />;
  if (t === 'Reset') return <ResetGlyph />;
  if (t === 'Edit') return <PencilGlyph />;
  if (t === 'View') return <EyeGlyph />;
  if (t === 'JSON' || t === 'Markdown' || t === 'PDF' || t === 'PNG') return <FileGlyph />;
  if (t === 'Front' || t === 'Back') return <LayersGlyph />;
  if (t === 'FormatPainter') return <BrushGlyph />;
  if (t === 'Diagram') return <DiagramGlyph />;
  if (t === 'Folder') return <FolderGlyph />;
  if (t === 'Tab') return <TabGlyph />;
  if (t === 'Element') return <ElementGlyph />;
  // Action-specific overrides (no type or unrecognised type).
  if (action === 'Deleted') return <TrashGlyph />;
  if (action === 'Created' || action === 'Added') return <PlusGlyph />;
  if (action === 'Duplicated') return <CopyGlyph />;
  if (action === 'Locked') return <LockGlyph />;
  if (action === 'Unlocked') return <UnlockGlyph />;
  if (action === 'Renamed') return <PencilGlyph />;
  if (action === 'Undone') return <UndoGlyph />;
  if (action === 'Redone') return <RedoGlyph />;
  if (action === 'Grouped' || action === 'Ungrouped') return <GroupGlyph />;
  if (action === 'Moved') return <MoveGlyph />;
  if (action === 'Reverted') return <RevertGlyph />;
  if (action === 'Reordered') return <LayersGlyph />;
  if (action === 'Aligned') return <AlignGlyph />;
  if (action === 'Cleared') return <ClearGlyph />;
  if (action === 'Linked' || action === 'Unlinked') return <LinkGlyph />;
  if (action === 'Resolved' || action === 'Unresolved') return <CheckGlyph />;
  if (action === 'Searched') return <MagnifierGlyph />;
  if (action === 'Selected') return <PointerGlyph />;
  if (action === 'Opened') return <OpenGlyph />;
  if (action === 'Closed') return <CloseGlyph />;
  if (action === 'Copied') return <ClipboardGlyph />;
  if (action === 'Imported') return <DownloadGlyph />;
  if (action === 'Exported') return <UploadGlyph />;
  if (action === 'Shared') return <ShareGlyph />;
  if (action === 'Joined') return <PersonGlyph />;
  if (action === 'Used') return <SparkGlyph />;
  if (action === 'Changed') return <PencilGlyph />;
  if (action === 'Toggled') return <ToggleGlyph />;
  if (action === 'Zoomed') return <FitGlyph />;
  if (action === 'SignedIn') return <SignInGlyph />;
  if (action === 'SignedUp') return <PersonAddGlyph />;
  if (action === 'SignedOut') return <SignOutGlyph />;
  // Category fallback.
  if (category === 'Diagram') return <DiagramGlyph />;
  if (category === 'Element') return <ElementGlyph />;
  if (category === 'Tab') return <TabGlyph />;
  if (category === 'Theme') return <PaletteGlyph />;
  if (category === 'Canvas') return <CanvasGlyph />;
  if (category === 'Template') return <TemplateGlyph />;
  if (category === 'Comment') return <CommentGlyph />;
  if (category === 'Note') return <NoteGlyph />;
  if (category === 'Search') return <MagnifierGlyph />;
  if (category === 'UI') return <WindowGlyph />;
  if (category === 'Folder') return <FolderGlyph />;
  if (category === 'Session') return <PersonGlyph />;
  return <DotGlyph />;
}

// All glyphs share a frame so the row layout stays stable regardless of
// which icon resolves. 14x14, currentColor, no fill (or subtle fill on
// shapes that need it). Intentionally minimalist line art so a row of
// 20+ icons doesn't get visually noisy.
const SVG_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
function RectGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="3" width="9" height="8" rx="0.8" />
    </svg>
  );
}
function CircleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="4" />
    </svg>
  );
}
function TriangleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2.5 L12 11.5 L2 11.5 Z" />
    </svg>
  );
}
function DiamondGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L12 7 L7 12 L2 7 Z" />
    </svg>
  );
}
function StarGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L8.5 5.5 L12 6 L9.4 8.4 L10 12 L7 10.2 L4 12 L4.6 8.4 L2 6 L5.5 5.5 Z" />
    </svg>
  );
}
function PolyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L11.5 4.5 L11.5 9.5 L7 12 L2.5 9.5 L2.5 4.5 Z" />
    </svg>
  );
}
function HeartGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 11.5 C 3 9 2 6.5 3.5 4.5 C 5 2.8 6.5 3.5 7 5 C 7.5 3.5 9 2.8 10.5 4.5 C 12 6.5 11 9 7 11.5 Z" />
    </svg>
  );
}
function CloudGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3.5 9.5 C 1.8 9.5 1.5 7 3.5 6.5 C 3.5 4.5 6 4 7 5.5 C 8 4 11 5 10.5 7 C 12.5 7.2 12.5 9.5 10.5 9.5 Z" />
    </svg>
  );
}
function CylinderGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <ellipse cx="7" cy="3.5" rx="4" ry="1.3" />
      <path d="M3 3.5 L3 10.5 C 3 11.5 11 11.5 11 10.5 L11 3.5" />
    </svg>
  );
}
function ArrowGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 7 L11 7" />
      <path d="M8 4 L11 7 L8 10" />
    </svg>
  );
}
function TextGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 4 L11 4" />
      <path d="M7 4 L7 11" />
    </svg>
  );
}
function StickyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 3 L11.5 3 L11.5 9 L8 12 L2.5 12 Z" />
      <path d="M8 12 L8 9 L11.5 9" />
    </svg>
  );
}
function ImageGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="3" width="10" height="8" rx="0.8" />
      <circle cx="5" cy="6" r="0.9" />
      <path d="M2.5 10.5 L5.5 7.5 L8.5 10 L10.5 8.5 L11.5 9.5" />
    </svg>
  );
}
function MoonGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M11 8.5 A 4.5 4.5 0 1 1 5.5 3 A 3.5 3.5 0 0 0 11 8.5 Z" />
    </svg>
  );
}
function SunGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="2.5" />
      <path d="M7 1.5 L7 3 M7 11 L7 12.5 M1.5 7 L3 7 M11 7 L12.5 7 M3 3 L4 4 M10 10 L11 11 M3 11 L4 10 M10 4 L11 3" />
    </svg>
  );
}
function GearGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1.5 L7 3 M7 11 L7 12.5 M1.5 7 L3 7 M11 7 L12.5 7 M3 3 L4.2 4.2 M9.8 9.8 L11 11 M3 11 L4.2 9.8 M9.8 4.2 L11 3" />
    </svg>
  );
}
function KeyboardGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="4" width="11" height="6" rx="0.8" />
      <path d="M4 6.5 L4 6.5 M6 6.5 L6 6.5 M8 6.5 L8 6.5 M10 6.5 L10 6.5 M4.5 8.5 L9.5 8.5" />
    </svg>
  );
}
function ShareGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="3" cy="7" r="1.6" />
      <circle cx="11" cy="3.5" r="1.6" />
      <circle cx="11" cy="10.5" r="1.6" />
      <path d="M4.4 6.2 L9.6 4 M4.4 7.8 L9.6 10" />
    </svg>
  );
}
function ActivityGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 7 L4 7 L5.5 3.5 L8.5 10.5 L10 7 L12.5 7" />
    </svg>
  );
}
function SparkGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L7.8 6.2 L12 7 L7.8 7.8 L7 12 L6.2 7.8 L2 7 L6.2 6.2 Z" />
    </svg>
  );
}
function LinkGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 8 L8 6" />
      <path d="M4.5 9.5 A 2 2 0 0 1 4.5 6.5 L6 5" />
      <path d="M9.5 4.5 A 2 2 0 0 1 9.5 7.5 L8 9" />
    </svg>
  );
}
function ZoomInGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
      <path d="M4.5 6 L7.5 6 M6 4.5 L6 7.5" />
    </svg>
  );
}
function ZoomOutGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
      <path d="M4.5 6 L7.5 6" />
    </svg>
  );
}
function FitGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 5 L2 2 L5 2 M9 2 L12 2 L12 5 M12 9 L12 12 L9 12 M5 12 L2 12 L2 9" />
    </svg>
  );
}
function ResetGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M11.5 7 A 4.5 4.5 0 1 1 7 2.5" />
      <path d="M7 1.5 L7 3.5 L9 3.5" />
    </svg>
  );
}
function PencilGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 11.5 L4.5 11 L11 4.5 L9.5 3 L3 9.5 Z" />
      <path d="M8 5 L9.5 6.5" />
    </svg>
  );
}
function EyeGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 7 C 3.5 3.5 10.5 3.5 12.5 7 C 10.5 10.5 3.5 10.5 1.5 7 Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}
function FileGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 1.5 L8.5 1.5 L11 4 L11 12.5 L3 12.5 Z" />
      <path d="M8.5 1.5 L8.5 4 L11 4" />
    </svg>
  );
}
function LayersGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2 L12 5 L7 8 L2 5 Z" />
      <path d="M2 8 L7 11 L12 8" />
    </svg>
  );
}
function BrushGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 12 C 3 9 5 9 6 10 L8 8 L6 6 L4 8 C 5 9 5 11 2 12 Z" />
      <path d="M6 6 L11 1.5 L12.5 3 L8 8" />
    </svg>
  );
}
function TrashGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 4 L11.5 4 M4 4 L4 2.5 L10 2.5 L10 4 M3.5 4 L4.5 12 L9.5 12 L10.5 4" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 2.5 L7 11.5 M2.5 7 L11.5 7" />
    </svg>
  );
}
function CopyGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="0.8" />
      <path d="M3 9.5 L3 3 C 3 2.5 3.5 2 4 2 L9.5 2" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="6.5" width="8" height="5.5" rx="0.8" />
      <path d="M4.5 6.5 L4.5 4.5 A 2.5 2.5 0 0 1 9.5 4.5 L9.5 6.5" />
    </svg>
  );
}
function UnlockGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="6.5" width="8" height="5.5" rx="0.8" />
      <path d="M4.5 6.5 L4.5 4.5 A 2.5 2.5 0 0 1 9.5 4.5" />
    </svg>
  );
}
function UndoGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 4 L1.5 6.5 L4 9" />
      <path d="M1.5 6.5 L8.5 6.5 A 3.5 3.5 0 0 1 8.5 12" />
    </svg>
  );
}
function RedoGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M10 4 L12.5 6.5 L10 9" />
      <path d="M12.5 6.5 L5.5 6.5 A 3.5 3.5 0 0 0 5.5 12" />
    </svg>
  );
}
function GroupGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="5" height="5" rx="0.6" />
      <rect x="7" y="7" width="5" height="5" rx="0.6" />
    </svg>
  );
}
function MoveGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 L7 12.5 M1.5 7 L12.5 7" />
      <path d="M5 3.5 L7 1.5 L9 3.5 M5 10.5 L7 12.5 L9 10.5 M3.5 5 L1.5 7 L3.5 9 M10.5 5 L12.5 7 L10.5 9" />
    </svg>
  );
}
function RevertGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 7 L4.5 4.5 L7 7" />
      <path d="M4.5 4.5 L4.5 9 A 3.5 3.5 0 0 0 8 12.5" />
    </svg>
  );
}
function AlignGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 3 L12 3 M2 7 L9 7 M2 11 L11 11" />
    </svg>
  );
}
function ClearGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="9" height="9" rx="0.8" />
      <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="5" />
      <path d="M4.5 7 L6.3 8.8 L9.5 5.5" />
    </svg>
  );
}
function MagnifierGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="6" cy="6" r="3.2" />
      <path d="M8.4 8.4 L11.5 11.5" />
    </svg>
  );
}
function PointerGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 2 L3 11 L5.5 8.5 L7.5 12 L9 11 L7 8 L11 8 Z" />
    </svg>
  );
}
function OpenGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 4 L7 4 L7 1.5 L12.5 6.5 L7 11.5 L7 9 L2.5 9 Z" />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="5" />
      <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
    </svg>
  );
}
function ClipboardGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="8" height="9.5" rx="0.8" />
      <rect x="5" y="1.5" width="4" height="2.5" rx="0.5" />
    </svg>
  );
}
function DownloadGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 L7 9" />
      <path d="M4 6 L7 9 L10 6" />
      <path d="M2 12 L12 12" />
    </svg>
  );
}
function UploadGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 12.5 L7 5" />
      <path d="M4 8 L7 5 L10 8" />
      <path d="M2 2 L12 2" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="5" r="2.2" />
      <path d="M2.5 12 C 3 9 11 9 11.5 12" />
    </svg>
  );
}
function PersonAddGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="5.5" cy="5" r="2.2" />
      <path d="M1.5 12 C 2 9 9 9 9.5 12" />
      <path d="M11 2 L11 6 M9 4 L13 4" />
    </svg>
  );
}
function SignInGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 1.5 L12.5 1.5 L12.5 12.5 L8 12.5" />
      <path d="M2 7 L9 7" />
      <path d="M6 4 L9 7 L6 10" />
    </svg>
  );
}
function SignOutGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M6 1.5 L1.5 1.5 L1.5 12.5 L6 12.5" />
      <path d="M5 7 L12 7" />
      <path d="M9 4 L12 7 L9 10" />
    </svg>
  );
}
function ToggleGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="4.5" width="11" height="5" rx="2.5" />
      <circle cx="9.5" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}
function DiagramGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="2.5" width="9" height="9" rx="0.8" />
      <path d="M2.5 6 L11.5 6" />
    </svg>
  );
}
function ElementGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="8" height="8" rx="0.8" />
    </svg>
  );
}
function TabGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 6 L4 6 L5 4 L9.5 4 L9.5 12 L1.5 12 Z" />
    </svg>
  );
}
function PaletteGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 1.5 C 3.5 1.5 1.5 4 1.5 7 C 1.5 10 4 12.5 7 12.5 C 7.5 12.5 8 12 8 11.5 L8 10.5 C 8 10 8.5 9.5 9 9.5 L10.5 9.5 C 11.5 9.5 12.5 9 12.5 7.5 C 12.5 4 10 1.5 7 1.5 Z" />
      <circle cx="4" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="7" cy="3.5" r="0.8" fill="currentColor" />
      <circle cx="10" cy="5.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
function CanvasGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="2.5" width="11" height="9" rx="0.5" />
      <path
        d="M1.5 5.5 L12.5 5.5 M1.5 8.5 L12.5 8.5 M4.5 2.5 L4.5 11.5 M8 2.5 L8 11.5"
        strokeWidth="0.6"
      />
    </svg>
  );
}
function TemplateGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="2" width="10" height="3" rx="0.4" />
      <rect x="2" y="6" width="4" height="6" rx="0.4" />
      <rect x="7" y="6" width="5" height="6" rx="0.4" />
    </svg>
  );
}
function CommentGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 3 L12.5 3 L12.5 9.5 L7 9.5 L4 12 L4 9.5 L1.5 9.5 Z" />
    </svg>
  );
}
function NoteGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 1.5 L11.5 1.5 L11.5 12.5 L2.5 12.5 Z" />
      <path d="M4.5 4.5 L9.5 4.5 M4.5 7 L9.5 7 M4.5 9.5 L7.5 9.5" strokeWidth="0.7" />
    </svg>
  );
}
function FolderGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M1.5 4 L5 4 L6.5 5.5 L12.5 5.5 L12.5 11.5 L1.5 11.5 Z" />
    </svg>
  );
}
function WindowGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1.5" y="2.5" width="11" height="9" rx="0.8" />
      <path d="M1.5 5 L12.5 5" />
      <circle cx="3" cy="3.7" r="0.3" fill="currentColor" />
      <circle cx="4.2" cy="3.7" r="0.3" fill="currentColor" />
    </svg>
  );
}
function DotGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
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
function DailySparkline({ days, totals }: { days: number[]; totals: number[] }) {
  const max = Math.max(...totals, 1);
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Daily volume — last 30 days
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Peak {max.toLocaleString()}</p>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1">
        {totals.map((v, i) => (
          <div
            key={days[i] ?? i}
            title={`${fmt(days[i] ?? 0)} · ${v.toLocaleString()}`}
            className="flex-1 rounded-sm bg-brand-200 transition hover:bg-brand-500 dark:bg-brand-500/40 dark:hover:bg-brand-400"
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{fmt(days[0] ?? 0)}</span>
        <span>{fmt(days[days.length - 1] ?? 0)}</span>
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
          <div
            key={g.category}
            title={`${g.category} · ${((g.subtotal / total) * 100).toFixed(1)}%`}
            style={{
              width: `${(g.subtotal / total) * 100}%`,
              backgroundColor: categoryColor(g.category),
            }}
          />
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
          <li
            key={`${row.category}:${row.action}:${row.type ?? ''}`}
            title={eventExplanation(row.category, row.action, row.type ?? null)}
            className="flex items-center gap-2 text-sm"
          >
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
  const max = Math.max(...series, 1);
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return (
    <div className="mt-3 flex h-10 items-end gap-[2px]">
      {series.map((v, i) => (
        <div
          key={days[i] ?? i}
          title={`${fmt(days[i] ?? 0)} · ${v.toLocaleString()}`}
          className="flex-1 rounded-[1px] bg-slate-200 dark:bg-slate-700"
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
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

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
              Total events
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">
              {(window?.total ?? 0).toLocaleString()}
            </p>
          </div>

          {/* Window-comparison strip: read all three windows at once
              without flipping the toggle. */}
          <div className="mt-6">
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
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {groups.map((group) => {
                const isOpen = expanded.has(group.category);
                return (
                  <div
                    key={group.category}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
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
                                <li
                                  key={`${row.action}:${row.type ?? ''}`}
                                  title={eventExplanation(
                                    row.category,
                                    row.action,
                                    row.type ?? null,
                                  )}
                                  className="py-1.5 text-sm"
                                >
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
