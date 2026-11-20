// The wire shapes of an agent's Pages edits (docs/specs/024-agents/pages-for-agents.md):
// the page changes and the article write `POST /api/documents/:id/tabs/:tabId/pages` takes,
// and what it answers. Shared by the api route, the engine (@liveknowledge/edit-operations), the
// verbs (CLI and MCP) and the views.
import type {
  ArticleLookId,
  PageKind,
  PageOrientation,
  PagePattern,
  PageSizeId,
} from '@liveknowledge/document';

// The most page changes one call takes (as change_items and change_sheet).
export const PAGE_CHANGES_MAX = 50;

// The longest page ref, layout id or article flow id taken (an article id's own cap).
export const PAGES_REF_MAX = 64;

// A page named by its id, its 1-based place in the row, or its name.
export type PageRef = string | number;

export type PageBackgroundInput = {
  // A solid fill, a hex colour.
  color?: string;
  // A two-stop gradient, hex colours from and to.
  gradient?: [string, string];
  // The gradient's angle in degrees; absent is the page panel's.
  angle?: number;
  pattern?: PagePattern | 'none';
  // Back to the plain paper.
  paper?: true;
};

export type PageChange =
  | {
      op: 'add';
      kind: PageKind;
      size?: PageSizeId;
      orientation?: PageOrientation;
      name?: string;
      background?: PageBackgroundInput;
      layout?: string;
      // The 1-based place it goes to; absent is the end.
      at?: number;
    }
  | {
      op: 'set';
      page: PageRef;
      name?: string;
      size?: PageSizeId;
      orientation?: PageOrientation;
      background?: PageBackgroundInput;
      locked?: boolean;
    }
  | { op: 'layout'; page: PageRef; layout: string }
  | { op: 'move'; page: PageRef; to: number }
  | { op: 'duplicate'; page: PageRef }
  | { op: 'delete'; page: PageRef }
  // Every other page of the page's kind takes its background, as the Background tab's Apply to All.
  | { op: 'apply_background_to_all'; page: PageRef };

type PageChangeOp = PageChange['op'];
export const PAGE_CHANGE_OPS: readonly PageChangeOp[] = [
  'add',
  'set',
  'layout',
  'move',
  'duplicate',
  'delete',
  'apply_background_to_all',
];

export type ArticleWriteMode = 'replace' | 'append';

// A page holds one article on the continuous page (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// continuous page"): a write names no new article, paper size, turn or page numbers.
export type ArticleWrite = {
  // The article by flow id or title; absent is the page's own, or a new one when it has none.
  article?: string;
  markdown: string;
  mode?: ArticleWriteMode;
  look?: ArticleLookId;
  accent?: string;
};

export type PagesRequest = { pages: PageChange[] } | { article: ArticleWrite };

export type PageRect = { x: number; y: number; width: number; height: number };

export type PageSummary = {
  place: number;
  id: string;
  name: string | null;
  kind: PageKind;
  size: PageSizeId;
  orientation: PageOrientation | null;
  rect: PageRect;
  background: string | null;
  locked: boolean;
  // The article it is a page of.
  flow: string | null;
  // How many elements are on it.
  elements: number;
};

export type ArticleSummary = {
  flow: string;
  title: string;
  // The places of its pages.
  pages: number[];
  blocks: number;
  words: number;
  // About how many pages its writing reaches once laid out (an estimate, article-layout-estimate.ts).
  estimatedPages: number;
  // How easily it reads, as the editor's Word Count says it (docs/specs/007-editor/article-pages.md "Word Count").
  readability: ArticleReadabilitySummary;
  look: ArticleLookId | null;
};

export type ArticleReadabilitySummary = {
  readingMinutes: number;
  sentences: number;
  wordsPerSentence: number;
  // Sentences over 30 words.
  longSentences: number;
  // Flesch Reading Ease, or null when the writing isn't English or has no sentence.
  ease: number | null;
  // The level in the Word Count line's words ("Easy to read" … "Hard to read"), or null.
  level: string | null;
};

export type PagesAnswer = {
  tab: { id: string; rev: number };
  lines: string[];
  pages: PageSummary[];
  articles: ArticleSummary[];
  article?: ArticleSummary & { created: boolean };
  changesetId: string | null;
};

const PAGES_REFUSAL_CODES = [
  'invalid_body',
  'invalid_value',
  'tab_locked',
  'page_unknown',
  'article_by_write',
  'size_not_offered',
  'no_orientation',
  'no_other_pages',
  'layout_unknown',
  'page_locked',
  'page_limit',
  'last_page',
  'kind_not_offered',
  'article_unknown',
  'article_ambiguous',
  'zone_unknown',
  'article_too_large',
] as const;

export type PagesRefusalCode = (typeof PAGES_REFUSAL_CODES)[number];

// A refusal: its code, what to do about it, and the 0-based index of the page change it stopped at.
export type PagesRefusal = { code: PagesRefusalCode; message: string; change?: number };
