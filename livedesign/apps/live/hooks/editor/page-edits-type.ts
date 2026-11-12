// What the page panel can do to a Pages tab's pages (docs/specs/007-editor/pages-mode.md), as pageEdits (page-edits.ts)
// builds it: each a tab edit, refused on a locked page. Split out of page-edits.ts, which re-exports it.

import {
  type PageBackground,
  type PageKind,
  type PageOrientation,
  type PageSizeId,
  type WireframeDeviceId,
  type WireframeDevicePatch,
} from '@livedesign/design';
import type { PageLayoutId } from '@livedesign/templates';
import { type BackgroundCopyEdits } from './pages-background-copy-edits';

export type PageEdits = BackgroundCopyEdits & {
  setOrientation: (pageId: string, next: PageOrientation) => void;
  setSize: (pageId: string, size: PageSizeId) => void;
  // Empty clears the name.
  rename: (pageId: string, name: string) => void;
  // Laid over the page's background: `{ fill: undefined }` is back to the paper.
  setBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  // -1 left, 1 right (past one neighbouring page or design); a no-op at the row's end.
  movePage: (pageId: string, by: -1 | 1) => void;
  // A page's unit (the page, or its whole design) to a place among the units (0 first), its
  // content with it: a Contents row dragged.
  movePageTo: (pageId: string, unitIndex: number) => void;
  // Absent at the page limit. A wireframe page takes the device chosen for it. Right after the page someone is on
  // (pages-mode.md "Adding a page"), else last.
  addPage?: (kind: PageKind, device?: WireframeDeviceId) => void;
  // Another page like this one, right after it (the + beside a page): its kind and shape, a
  // wireframe page's device and frame too. Absent at the page limit.
  // Right after `after` (Contents' page here) when given, else right after `pageId`.
  addPageLike?: (pageId: string, after?: string) => void;
  // A photo page added after a page (else at the end), of a picture's size, gone to: answers its id
  // (Edit as Photo, docs/specs/031-photo/photo-pages.md "Making a photo page"). Absent at the page
  // limit and on a tab not of photos ("One kind a tab").
  addPhotoPage?: (after: string | null, size?: { width: number; height: number }) => string | null;
  // The first page's kind chosen while it is the only page and empty (its own choice cards).
  choosePageKind: (pageId: string, kind: PageKind, device?: WireframeDeviceId) => void;
  // A wireframe page's orientation, frame look or system bars; its device is fixed once made
  // (docs/specs/007-editor/wireframe-pages.md "Choosing the device").
  setDevice: (pageId: string, patch: WireframeDevicePatch) => void;
  duplicatePage?: (pageId: string) => void;
  // Whether a page's copy fits under the page limit.
  canDuplicate: (pageId: string) => boolean;
  // Deletes a page, or its whole design; the last one empties the tab, which opens Start Making Pages again.
  removePage?: (pageId: string) => void;
  // A Fit to Content page split into one page per cluster of its content, nothing scaled
  // (docs/specs/007-editor/pages-mode.md "Split Into Pages").
  splitPage: (pageId: string) => void;
  // Whether the page's unit can move left / right (not at the row's end).
  canMove: (pageId: string, by: -1 | 1) => boolean;
  // Puts a layout onto the page in place of everything on it (the panel asks first when there is
  // anything to replace).
  // Resolves once the layout is placed (its builders load on the first apply).
  applyLayout: (pageId: string, layout: PageLayoutId) => Promise<void>;
  // How many elements are on the page.
  contentCount: (pageId: string) => number;
  // A fill hovered in the panel: what is on the page drawn re-inked as the press would re-ink it
  // (a preview, writing nothing); null puts it back.
  previewInk: (preview: { pageId: string; patch: Partial<PageBackground> } | null) => void;
  // Locking a page (docs/specs/007-editor/pages-mode.md "Locking a page"): it, and what is
  // on it, stay as they are. Every edit above refuses a locked page.
  isLocked: (pageId: string) => boolean;
  setLocked: (pageId: string, locked: boolean) => void;
  // Blank chosen on the page's Start From a Layout card: the card is not offered there again.
  startBlank: (pageId: string) => void;
};
