import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  ArticleBlock,
  ArticleFlow,
  ArticleNotePlace,
  LaidOutPage,
} from '@livedocuments/document';
import type { CardSplit } from '@/lib/flashcard-split';
import type { ArticleInk } from '@/lib/article/article-style-vars';
import type { ArticleInsert } from '@/hooks/editor/useArticles';

export type FlowLayout = {
  flow: string;
  // How many pages the writing reaches.
  pagesNeeded: number;
  // Where each zone landed: its page (by index among the article's pages) and its top-left from
  // that page's corner, and its size, in canvas px.
  zones: { id: string; index: number; x: number; y: number; width: number; height: number }[];
  // Where each margin note's text starts: its first line's page, top and height.
  notes: ArticleNotePlace[];
  // Whether this person made the change that laid it out (only they settle its consequences).
  local: boolean;
};

export type FocusRequest = { flow: string; at: 'start' | 'end'; seq: number } | null;

export type ArticleEditorProps = {
  flow: string;
  // The article's pages, laid out, in order.
  pages: LaidOutPage[];
  // The tab holds as many pages as it can (MAX_PAGES): no page is added for writing that
  // runs past the last.
  atPageLimit?: boolean;
  // A flashcard (docs/specs/007-editor/flashcards.md): text only, laid out on its one card and
  // never grown; writing past its foot is cut off there and said so.
  card?: boolean;
  // Split Onto a New Card from the Too long marker: given to someone who may change the pages.
  split?: CardSplit | undefined;
  doc: ArticleFlow;
  editable: boolean;
  // Whether the writer may reshape the article too (the slash menu's inserts): an Editor. A Participant writes
  // only (docs/specs/013-workspace/share-roles.md). Absent: as `editable`.
  reshape?: boolean;
  // Whether a press on the writing is the writing's (not while a drawing tool is in hand).
  interactive: boolean;
  zoom: number;
  ink: ArticleInk;
  themeAccent: string;
  margin: number;
  // The least top margin: the toolbar's room, and a header's band above it (ARTICLE_TOP_MIN_PX when absent).
  topMin?: number;
  // A style shown in place of the article's own while a Style tab choice is hovered.
  styleOverride?: ArticleFlow['style'];
  // The writing's blocks, written to the tab (one undo step, one sync).
  // False when the host refuses the writing (the tab locked, no rights).
  onCommit: (flow: string, blocks: ArticleBlock[]) => boolean;
  onLayout: (layout: FlowLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLinkRequest: () => void;
  // A click on a margin note's text: its thread, or its action, opens beside it.
  onNoteOpen?: (id: string, kind: 'comment' | 'action') => void;
  // An object put in at the caret (the slash menu): a table, a chart, a drawing...
  onInsert: (flow: string, what: ArticleInsert) => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
  // A finger on the writing: pans the view when it travels, else calls back on its tap (the
  // browser has put the caret by then). False for a mouse or a pen.
  onTouchPress?: (e: ReactPointerEvent, onTap?: () => void) => boolean;
  focusRequest: FocusRequest;
  // The request was taken (it is spent).
  onFocusTaken?: (seq: number) => void;
  // Where the caret is, as a canvas rect, after the writer types or moves it: the view keeps it in sight
  // (docs/specs/007-editor/article-pages.md "Writing").
  onRevealCaret?: (rect: { x: number; y: number; w: number; h: number }) => void;
};

// The slash menu while open: its query and where the `/` is.
export type SlashState = {
  query: string;
  at: { left: number; top: number; bottom: number };
};
