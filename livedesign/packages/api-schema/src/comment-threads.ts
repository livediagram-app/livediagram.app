// Comment threads as the api lists them across a design (docs/specs/024-agents/agent-presence.md "Comments",
// blueprint "REST"): one thread per element, with the element's ref and label, so an agent can read the
// conversation without reading the tab. The statuses and the text cap are liveworkspace's
// (@liveworkspace/api-schema/comment-threads). The thread is the same shape as every product's
// (DocumentCommentThread there), declared here so the api's OpenAPI document keeps naming it
// `DesignCommentThread`.

import type { CommentMention, ReactionSummary } from '@livedesign/design';

export {
  COMMENT_LIST_STATUSES,
  COMMENT_TEXT_MAX,
  isCommentListStatus,
  type CommentListStatus,
} from '@liveworkspace/api-schema/comment-threads';

export type DesignCommentThread = {
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
    // Who reacted, one entry per emoji used (docs/specs/012-collaboration/comment-reactions.md). Absent when none.
    reactions?: ReactionSummary[];
    // The caller's own comments only.
    authorId?: string;
    tokenId?: string;
  }[];
};

// GET /api/designs/:id/comments?status=open|resolved|all.
export type DesignCommentsResponse = { threads: DesignCommentThread[] };
