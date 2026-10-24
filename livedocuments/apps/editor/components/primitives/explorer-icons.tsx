import type { ReactNode } from 'react';
import {
  CheckIcon as SharedCheckIcon,
  DuplicateIcon as SharedDuplicateIcon,
  Glyph,
  lucideGlyph,
  PencilIcon as SharedPencilIcon,
  PlusIcon as SharedPlusIcon,
  SparkleIcon as SharedSparkleIcon,
  TrashIcon as SharedTrashIcon,
} from '@livedocuments/ui';
import {
  lucideAppWindow,
  lucideCloudUpload,
  lucideDownload,
  lucideExternalLink,
  lucideHouse,
  lucideImage,
  lucideShare2,
} from '@livedocuments/icons/lucide';

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
// The close / dismiss X is not here: it is CloseIcon in @livedocuments/ui.

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

export const ShareIcon = lucideGlyph(lucideShare2, 13);
export const ImageIcon = lucideGlyph(lucideImage, 13);
// A team: one drawing, shared with the landing page (@livedocuments/ui).
export { TeamIcon } from '@livedocuments/ui';
// The sidebar rows of docs/specs/013-workspace/explorer-structure.md: Home (the Timeline), My
// documents (a root folder), Library, and This Browser (a browser window).
export const HomeIcon = lucideGlyph(lucideHouse, 13);
export const ThisBrowserIcon = lucideGlyph(lucideAppWindow, 13);

// ---------- Verbs ----------------------------------------------------

// The shared verbs from @livedocuments/ui, at this set's default sizes.
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
