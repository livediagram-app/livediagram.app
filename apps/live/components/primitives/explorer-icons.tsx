import type { CSSProperties, ReactNode } from 'react';
import { PlusWideIcon, TrashIcon as SharedTrashIcon } from '@livediagram/ui';

// The one glyph set for both Explorer surfaces: the full-page /explorer
// route and the editor's floating Explorer panel, plus the menus and panes
// that borrow from them (tab menu, share dialog, slide deck, team pane).
//
// It used to be two files, app/explorer/icons.tsx and
// components/panels/explorer-icons.tsx, whose comments each said the other
// had diverged too far to merge. Half the pairs were byte-identical or
// differed only in pixel size, and the rest had drifted by accident (two
// pencils, two trash cans, two team marks). Now each concept has one
// drawing and a `size` prop, so a caller asks for the pixels it needs
// rather than picking between near-copies.
//
// Two folders are kept on purpose, because both are genuinely used:
// FolderSolidIcon (the page's filled folder, which morphs open) and
// FolderOutlineIcon (the line folder of the panel tree and the menus).
//
// The close / dismiss X is not here: it is CloseIcon in @livediagram/ui.

type IconProps = { size?: number };

// The shared <svg> shell for the stroked glyphs below: a 16-unit viewBox,
// round caps and joins, colour from `currentColor`.
function StrokeGlyph({
  size,
  strokeWidth = 1.5,
  viewBox = '0 0 16 16',
  fill = 'none',
  style,
  children,
}: {
  size: number;
  strokeWidth?: number;
  viewBox?: string;
  fill?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

// ---------- Tree + folders -----------------------------------------

// The tree's disclosure chevron: points right, turns down when `open`.
// (The accordion chevron that points down and flips is
// components/primitives/ChevronIcon, a different control.)
export function TreeChevronIcon({ open = false, size = 10 }: IconProps & { open?: boolean }) {
  return (
    <StrokeGlyph
      size={size}
      viewBox="0 0 10 10"
      strokeWidth={1.8}
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}
    >
      <path d="M3 2l4 3-4 3" />
    </StrokeGlyph>
  );
}

// The page's filled folder, which opens when its subtree is expanded.
export function FolderSolidIcon({ open = false, size = 13 }: IconProps & { open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {open ? (
        <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39h4.05A1.5 1.5 0 0 1 14.5 6.5H1.5v-2zm0 3h13l-.93 4.65a1.5 1.5 0 0 1-1.47 1.2H3.9a1.5 1.5 0 0 1-1.47-1.2L1.5 7.5z" />
      ) : (
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z" />
      )}
    </svg>
  );
}

// The line folder: the panel tree's folders, and every menu's Change
// Folder / folder chip.
export function FolderOutlineIcon({ size = 12 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.6}>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1 1 0 0 1 .77.37l1 1.24A1 1 0 0 0 8.45 5h4.05A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
    </StrokeGlyph>
  );
}

// Folder with a lightning mark for the "Dynamic" parent of the synthetic
// folders (Unsorted / Generated / Offline): live views over your diagrams,
// not folders-table rows.
export function DynamicFolderIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.4}>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.9a1 1 0 0 1 .77.37l.86 1.06a1 1 0 0 0 .78.37h3.69A1.5 1.5 0 0 1 14 6.3v5.2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
      <path d="M8.7 6.7 7.1 9.1h1.8L7.3 11.4" />
    </StrokeGlyph>
  );
}

// Dashed folder outline for the synthetic Unsorted folder: folder-shaped so
// it still reads as a place diagrams live, dashed so it reads as a dynamic
// view rather than a real folders-table row.
export function UnsortedIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.4}>
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.9a1 1 0 0 1 .77.37l.86 1.06a1 1 0 0 0 .78.37h3.69A1.5 1.5 0 0 1 14 6.3v5.2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z"
        strokeDasharray="2.2 1.8"
      />
    </StrokeGlyph>
  );
}

// Cloud-with-slash for the synthetic Offline folder (spec/76): diagrams
// saved only in this browser, never on the server.
export function OfflineFolderIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M4.5 12h6.6a2.4 2.4 0 0 0 .4-4.77 3.4 3.4 0 0 0-6.3-.8A2.3 2.3 0 0 0 4.5 12Z" />
      <path d="M2.8 2.8l10.4 10.4" />
    </StrokeGlyph>
  );
}

// Sparkle for the synthetic "Generated" folder (AI / MCP-created diagrams).
export function SparkleIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M8 2.5c.4 2.2 1.3 3.1 3.5 3.5C9.3 6.4 8.4 7.3 8 9.5 7.6 7.3 6.7 6.4 4.5 6 6.7 5.6 7.6 4.7 8 2.5Z" />
      <path d="M12.5 9.5c.2 1 .6 1.4 1.5 1.5-.9.2-1.3.6-1.5 1.5-.2-.9-.6-1.3-1.5-1.5.9-.1 1.3-.5 1.5-1.5Z" />
    </StrokeGlyph>
  );
}

// ---------- Sections -------------------------------------------------

export function DiagramIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </StrokeGlyph>
  );
}

// The Timeline section (spec/138): a vertical rail with event dots
// hanging off it: the shape of the feed itself, and deliberately not
// another clock (Recent already owns that glyph, and the two sections
// now sit next to each other in Quick find).
export function TimelineIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M4 2v12" />
      <circle cx="4" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4" cy="9" r="1.3" fill="currentColor" stroke="none" />
      <path d="M7 4.5h6M7 9h4" />
    </StrokeGlyph>
  );
}

// Activity (spec/142): an inbox tray with a tick, what's waiting on
// you, as opposed to the Timeline's spine of what happened.
export function ActivityIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M2 9.5V12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 12V9.5" />
      <path d="M2 9.5h3.2l1 1.8h3.6l1-1.8H14" />
      <path d="M5.5 5.2 7.2 7l3.3-3.6" />
    </StrokeGlyph>
  );
}

// Clock: the Recent list, and the row menu's hide / show in Recent
// (spec/93); the label carries the direction, the glyph the topic.
export function ClockIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2 1.5" />
    </StrokeGlyph>
  );
}

// The clock with a strike-through: a diagram hidden from Recent
// (spec/93). Paired with ClockIcon so the menu row's glyph flips with
// its label rather than relying on the wording alone.
export function ClockOffIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2 1.5" />
      <path d="M3 13L13 3" />
    </StrokeGlyph>
  );
}

// Star: per-user favourites (spec/95). Filled when the diagram is
// starred, hollow when it isn't, so a menu row's glyph carries the state
// alongside its label.
export function StarIcon({ filled = false, size = 13 }: IconProps & { filled?: boolean }) {
  return (
    <StrokeGlyph size={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M8 2.2l1.75 3.55 3.92.57-2.84 2.76.67 3.9L8 11.15l-3.5 1.83.67-3.9L2.33 6.32l3.92-.57z" />
    </StrokeGlyph>
  );
}

export function ShareIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M5.8 7l4.4-2.2M5.8 9l4.4 2.2" />
    </StrokeGlyph>
  );
}

export function ImageIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="7" r="1.2" />
      <path d="M2.5 12l3-3 2.5 2.5L11 8l3 3" />
    </StrokeGlyph>
  );
}

// Painter's palette: the Themes section (spec/44).
export function PaletteIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M8 2a6 6 0 0 0 0 12c1 0 1.4-.7 1.4-1.3 0-.7-.6-1-.6-1.7 0-.5.4-.9 1-.9H11A3 3 0 0 0 14 7c0-2.8-2.7-5-6-5z" />
      <circle cx="5.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </StrokeGlyph>
  );
}

export function KeyIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <circle cx="5.5" cy="5.5" r="3" />
      <path d="M7.7 7.7 13.5 13.5" />
      <path d="M11 11l1.2-1.2M12.3 12.3l1.2-1.2" />
    </StrokeGlyph>
  );
}

export function TeamIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <circle cx="5.5" cy="6" r="2.2" />
      <path d="M1.8 13.2c.5-2.1 1.9-3.2 3.7-3.2s3.2 1.1 3.7 3.2" />
      <circle cx="11.5" cy="5" r="1.8" />
      <path d="M10.4 9.3c.35-.1.72-.15 1.1-.15 1.6 0 2.8 1 3.2 2.85" />
    </StrokeGlyph>
  );
}

export function InviteIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5L8 9l5.5-4.5" />
    </StrokeGlyph>
  );
}

// ---------- Verbs ----------------------------------------------------

// The shared plus and trash from @livediagram/ui, at this set's default sizes.
export function PlusIcon({ size = 12 }: IconProps) {
  return <PlusWideIcon size={size} />;
}

export function CheckIcon({ size = 12 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.8}>
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </StrokeGlyph>
  );
}

export function PencilIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M10 4l2 2" />
    </StrokeGlyph>
  );
}

export function DuplicateIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <rect x="5" y="5" width="8" height="8" rx="1.25" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </StrokeGlyph>
  );
}

// `strokeWidth` as well as `size`, because the delete buttons that share
// this can differ in weight as well as size (ActivityPanel 12/1.5,
// MultiSelectionToolbar 14/1.5, GalleryPane + ImagePicker 13/1.6,
// SelectionPopover 16/1.75).
export function TrashIcon({ size = 13, strokeWidth = 1.5 }: IconProps & { strokeWidth?: number }) {
  return <SharedTrashIcon size={size} strokeWidth={strokeWidth} />;
}

export function OpenIcon({ size = 13 }: IconProps) {
  return (
    <StrokeGlyph size={size}>
      <path d="M9.5 2.5h4v4" />
      <path d="M13 3L7.5 8.5" />
      <path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" />
    </StrokeGlyph>
  );
}

// Offline Mode conversions (spec/76), from the diagram menu: a cloud with
// an arrow going up into it, and a tray with an arrow coming down.
export function SyncIcon({ size = 14 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.4}>
      <path d="M4.5 12.5h6.5a2.6 2.6 0 0 0 .3-5.2 3.6 3.6 0 0 0-6.7-.8A2.5 2.5 0 0 0 4.5 12.5Z" />
      <path d="M8 11V7m0 0L6.6 8.4M8 7l1.4 1.4" />
    </StrokeGlyph>
  );
}

export function TakeOfflineIcon({ size = 14 }: IconProps) {
  return (
    <StrokeGlyph size={size} strokeWidth={1.4}>
      <path d="M8 2.5v6m0 0L5.6 6.1M8 8.5l2.4-2.4" />
      <path d="M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
    </StrokeGlyph>
  );
}

// A clock with an arrow curling back: a diagram's History. Distinct from
// ClockIcon, which the same menu uses for Hide-from-Recent.
export function HistoryIcon({ size = 16 }: IconProps) {
  return (
    <StrokeGlyph size={size} viewBox="0 0 24 24" strokeWidth={1.7}>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l3 2" />
    </StrokeGlyph>
  );
}
