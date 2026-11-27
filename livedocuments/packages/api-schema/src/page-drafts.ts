// Describe a Page's wire (docs/specs/007-editor/describe-a-page.md; blueprint "The api"): the person's words and the
// tab's kind sent to `POST /api/page-drafts`, answered with what to make: a layout and the words for its slots (a
// slide, an infographic page), or Markdown (an article, a card). The editor makes the page from it, as an agent's
// change_pages "layout" and write_article make theirs.
import type { PageKind } from '@livedocuments/document';
import type { LayoutText } from '@liveworkspace/edit-operations/layout-slots';

/** The api's resource for it, the segment after `/api`. */
export const PAGE_DRAFTS_PATH = 'page-drafts';

/** The most of the person's words taken. */
export const PAGE_DRAFT_PROMPT_MAX = 500;

export type PageDraftRequest = {
  prompt: string;
  // The open document and tab: only an Editor of it may make a page there.
  documentId: string;
  tabId: string;
  // The tab's kind: the page made is one of it.
  kind: PageKind;
  // The document's team, for its key.
  teamId?: string;
  // Built-in AI chosen though a key applies.
  ai?: 'built-in';
};

export type PageDraft =
  // A slide or an infographic page: a layout of the kind's catalogue, its name, and the words for its slots.
  | { kind: 'layout'; layout: string; label: string; text: LayoutText }
  // An article or a card: its writing as Markdown.
  | { kind: 'writing'; markdown: string };

export type PageDraftResponse = { draft: PageDraft; provider: string; model: string };

export const PAGE_DRAFT_ERRORS = [
  'page_draft_needs_account',
  'page_draft_invalid',
  'page_draft_forbidden',
  'page_draft_off_topic',
  'page_draft_unreadable',
  'page_draft_unavailable',
  'page_draft_built_in_limit',
  'page_draft_failed',
  'ai_key_failed',
  'ai_credits_used',
  'ask_by_others_limit',
] as const;
export type PageDraftError = (typeof PAGE_DRAFT_ERRORS)[number];

export type PageDraftErrorBody = { error: PageDraftError; message: string };
