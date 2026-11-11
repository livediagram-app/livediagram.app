// What the page panel can do to a Pages tab's pages (docs/specs/007-editor/pages-mode.md), as pageEdits
// (page-edits.ts) builds it. Split out of page-edits.ts, which re-exports it.
import type {
  PageBackground,
  PageKind,
  PageOrientation,
  PageSizeId,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import type { BackgroundCopyEdits } from './pages-background-copy-edits';
import type { CardSplitState } from './page-split-edits';

export type PageEdits = BackgroundCopyEdits & {
  setOrientation: (pageId: string, next: PageOrientation) => void;
  setSize: (pageId: string, size: PageSizeId) => void;
  // Empty clears the name.
  rename: (pageId: string, name: string) => void;
  // Laid over the page's background: `{ fill: undefined }` is back to the paper.
  setBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  // -1 left, 1 right (past one neighbouring page or document); a no-op at the row's end.
  movePage: (pageId: string, by: -1 | 1) => void;
  // A page's unit (the page, or its whole document) to a place among the units (0 first), its
  // content with it: a Contents row dragged.
  movePageTo: (pageId: string, unitIndex: number) => void;
  // Absent at the page limit. Right after the page someone is on (pages-mode.md "Adding a page"), else last.
  addPage?: (kind: PageKind) => void;
  // Another page like this one, right after it (the + beside a page): its kind and shape.
  // Absent at the page limit.
  // Right after `after` (Contents' page here) when given, else right after `pageId`.
  addPageLike?: (pageId: string, after?: string) => void;
  // The first page's kind chosen while it is the only page and empty (its own choice cards).
  choosePageKind: (pageId: string, kind: PageKind) => void;
  duplicatePage?: (pageId: string) => void;
  // Whether a page's copy fits under the page limit (an article's copy is all its pages).
  canDuplicate: (pageId: string) => boolean;
  // Deletes a page, or its whole document; the last one empties the tab, which opens Start Making Pages again.
  removePage?: (pageId: string) => void;
  // A Fit to Content page split into one page per cluster of its content, nothing scaled
  // (docs/specs/007-editor/pages-mode.md "Split Into Pages").
  splitPage: (pageId: string) => void;
  // Split Onto a New Card (docs/specs/007-editor/flashcards.md "Never flows"): a too-long card's
  // writing from its first block that does not fit moves onto a new card right after it.
  splitCard: (pageId: string) => void;
  // Whether a card can be split now: it fits ('fits'), it can ('ready'), or why not.
  cardSplitState: (pageId: string) => CardSplitState;
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
  // An infographic page's Tidy Up (docs/specs/007-editor/pages-mode.md "Tidy"): its
  // elements aligned and spaced, one edit; a page already tidy says so and writes nothing.
  tidyPage?: (pageId: string) => void;
  // Whether a Tidy would change the page: its button shows only then.
  canTidy?: (pageId: string) => boolean;
  // The tidied page drawn in place while the button is hovered (a preview, writing nothing); null
  // puts it back.
  previewTidy?: (pageId: string | null) => void;
};
