// Comment threads as the api lists them across a document (docs/specs/024-agents/agent-presence.md "Comments",
// blueprint "REST"): one thread per element, with the element's ref and label, so an agent can read the
// conversation without reading the tab.

import type { CommentMention } from '@livediagram/document';

export const COMMENT_TEXT_MAX = 2000;

export const COMMENT_LIST_STATUSES = ['open', 'resolved', 'all'] as const;
export type CommentListStatus = (typeof COMMENT_LIST_STATUSES)[number];

export function isCommentListStatus(value: unknown): value is CommentListStatus {
  return COMMENT_LIST_STATUSES.some((status) => status === value);
}

export type DocumentCommentThread = {
  tabId: string;
  tabName: string;
  elementId: string;
  ref: string;
  label: string | null;
  resolved: boolean;
  comments: {
    id: string;
    text: string;
    createdAt: number;
    authorName: string;
    authorColor: string;
    mentions?: CommentMention[];
    // The caller's own comments only.
    authorId?: string;
    tokenId?: string;
  }[];
};

// GET /api/documents/:id/comments?status=open|resolved|all.
export type DocumentCommentsResponse = { threads: DocumentCommentThread[] };
