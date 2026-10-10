import type { ReactNode } from 'react';
import {
  CheckIcon as SharedCheckIcon,
  DuplicateIcon as SharedDuplicateIcon,
  Glyph,
  lucideGlyph,
  PencilIcon as SharedPencilIcon,
  PlusIcon as SharedPlusIcon,
  Prims,
  SparkleIcon as SharedSparkleIcon,
  TrashIcon as SharedTrashIcon,
} from '@livediagram/ui';
import {
  lucideAppWindow,
  lucideClock,
  lucideCloudUpload,
  lucideDownload,
  lucideExternalLink,
  lucideFolder,
  lucideFolderRoot,
  lucideHistory,
  lucideHouse,
  lucideImage,
  lucideKey,
  lucideLibrary,
  lucideMail,
  lucidePalette,
  lucideShapes,
  lucideShare2,
  lucideStar,
  lucideUsers,
} from '@livediagram/icons/lucide';

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

// In-house drawings of this set: a 16-unit grid through the house Glyph.
function G16({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Glyph size={size} units={16}>
      {children}
    </Glyph>
  );
}

// ---------- Tree + folders -----------------------------------------

// The tree's disclosure chevron: points right, turns down when `open`.
// (The accordion chevron that points down and flips is
// components/primitives/ChevronIcon, a different control.)
export function TreeChevronIcon({ open = false, size = 10 }: IconProps & { open?: boolean }) {
  return (
    <Glyph
      size={size}
      units={10}
      style={{
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform var(--transition-duration-micro)',
      }}
    >
      <path d="M3.5 2 6.5 5l-3 3" />
    </Glyph>
  );
}

// The page's filled folder, which opens when its subtree is expanded.
export function FolderSolidIcon({ open = false, size = 13 }: IconProps & { open?: boolean }) {
  return (
    <Glyph size={size} units={16} filled>
      {open ? (
        <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39h4.05A1.5 1.5 0 0 1 14.5 6.5H1.5v-2zm0 3h13l-.93 4.65a1.5 1.5 0 0 1-1.47 1.2H3.9a1.5 1.5 0 0 1-1.47-1.2L1.5 7.5z" />
      ) : (
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z" />
      )}
    </Glyph>
  );
}

// The line folder: the panel tree's folders, and every menu's Change Folder / folder chip.
export const FolderOutlineIcon = lucideGlyph(lucideFolder, 12);

// Sparkle for the synthetic "Generated" folder (AI / MCP-created documents): the one shared sparkle.
export function SparkleIcon({ size = 13 }: IconProps) {
  return <SharedSparkleIcon size={size} />;
}

// ---------- Sections -------------------------------------------------

export function DocumentIcon({ size = 13 }: IconProps) {
  return (
    <G16 size={size}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </G16>
  );
}

// The Inbox (docs/specs/013-workspace/inbox.md): a tray with a tick, what's waiting on you, as
// opposed to the Timeline's spine of what happened.
export function InboxIcon({ size = 13 }: IconProps) {
  return (
    <G16 size={size}>
      <path d="M2 9.5V12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 12V9.5" />
      <path d="M2 9.5h3.2l1 1.8h3.6l1-1.8H14" />
      <path d="M5.5 5.2 7.2 7l3.3-3.6" />
    </G16>
  );
}

// The Timeline (docs/specs/013-workspace/timeline.md): a spine with what landed against it, the
// help centre's Timeline card glyph on this set's 16-unit grid.
export function TimelineIcon({ size = 13 }: IconProps) {
  return (
    <G16 size={size}>
      <path d="M4 2.5v11" />
      <circle cx="4" cy="5" r="1.1" />
      <circle cx="4" cy="11" r="1.1" />
      <path d="M6.5 5h6M6.5 11h4M6.5 8h2.8" />
    </G16>
  );
}

// Clock: the Recent list, and the row menu's hide / show in Recent
// (docs/specs/013-workspace/hide-from-recent.md); the label carries the direction, the glyph the topic.
export const ClockIcon = lucideGlyph(lucideClock, 13);

// The clock with a strike-through: a document hidden from Recent
// (docs/specs/013-workspace/hide-from-recent.md). Paired with ClockIcon so the menu row's glyph flips with
// its label rather than relying on the wording alone.
export function ClockOffIcon({ size = 13 }: IconProps) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideClock} />
      <path d="M4 20 20 4" />
    </Glyph>
  );
}

// Star: per-user favourites (docs/specs/013-workspace/favourites.md). Filled when the document is
// starred, hollow when it isn't, so a menu row's glyph carries the state
// alongside its label.
export function StarIcon({ filled = false, size = 13 }: IconProps & { filled?: boolean }) {
  return (
    <Glyph size={size} units={24} fill={filled ? 'currentColor' : 'none'}>
      <Prims prims={lucideStar} />
    </Glyph>
  );
}

export const ShareIcon = lucideGlyph(lucideShare2, 13);
export const ImageIcon = lucideGlyph(lucideImage, 13);
// Painter's palette: the Themes section (docs/specs/011-theme/custom-themes.md).
export const PaletteIcon = lucideGlyph(lucidePalette, 13);
// Three shapes: the Shape libraries section (docs/specs/013-workspace/shape-libraries.md).
export const ShapesIcon = lucideGlyph(lucideShapes, 13);
export const KeyIcon = lucideGlyph(lucideKey, 13);
export const TeamIcon = lucideGlyph(lucideUsers, 13);
export const InviteIcon = lucideGlyph(lucideMail, 13);
// The sidebar rows of docs/specs/013-workspace/explorer-structure.md: Home (the Timeline), My
// documents (a root folder), Library, and This browser (a browser window).
export const HomeIcon = lucideGlyph(lucideHouse, 13);
export const MyDocumentsIcon = lucideGlyph(lucideFolderRoot, 13);
export const LibraryIcon = lucideGlyph(lucideLibrary, 13);
export const ThisBrowserIcon = lucideGlyph(lucideAppWindow, 13);

// ---------- Verbs ----------------------------------------------------

// The shared verbs from @livediagram/ui, at this set's default sizes.
export function PlusIcon({ size = 12 }: IconProps) {
  return <SharedPlusIcon size={size} />;
}

export function CheckIcon({ size = 12 }: IconProps) {
  return <SharedCheckIcon size={size} />;
}

export function PencilIcon({ size = 13 }: IconProps) {
  return <SharedPencilIcon size={size} />;
}

export function DuplicateIcon({ size = 13 }: IconProps) {
  return <SharedDuplicateIcon size={size} />;
}

export function TrashIcon({ size = 13 }: IconProps) {
  return <SharedTrashIcon size={size} />;
}

export const OpenIcon = lucideGlyph(lucideExternalLink, 13);

// Offline Mode conversions (docs/specs/006-document/offline-mode.md), from the document menu: a cloud with
// an arrow going up into it, and a tray with an arrow coming down.
export const SyncIcon = lucideGlyph(lucideCloudUpload, 14);
export const TakeOfflineIcon = lucideGlyph(lucideDownload, 14);

// A clock with an arrow curling back: a document's History. Distinct from
// ClockIcon, which the same menu uses for Hide-from-Recent.
export const HistoryIcon = lucideGlyph(lucideHistory, 16);
