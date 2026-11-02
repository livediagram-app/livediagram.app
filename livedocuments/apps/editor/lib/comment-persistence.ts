import type { CommentMention } from '@livedocuments/document';
import {
  apiAddComment,
  apiDeleteComment,
  apiReactToComment,
  apiSetThreadResolved,
} from '@/lib/api-client';

// How a comment change is kept (docs/specs/008-canvas/canvas-and-palette.md "Comments", docs/specs/013-workspace/share-roles.md):
// an Editor's rides the room and the tab autosave; a read-only session (a Participant, or a Viewer the popover lets
// read) has no autosave, so its add, delete, resolve and reopen go through the dedicated comment endpoints. Shared by
// every surface that drives the thread machinery, so none of them can forget it: the Comment panel did, and a
// Participant's panel comment stayed on their own screen, unsaved and unseen by anyone else.
export type CommentSession = {
  readOnly: boolean;
  documentId: string | null;
  tabId: string;
  selfId: string;
  shareCode: string | null;
};

type Thread = { comments: readonly { id: string }[] } | undefined;

export function commentPersisters(session: CommentSession) {
  const { readOnly, documentId, tabId, selfId, shareCode } = session;
  const endpoint = readOnly && documentId !== null ? documentId : null;
  return {
    add: (elementId: string, text: string, mentions?: CommentMention[], cell?: string) =>
      endpoint === null
        ? undefined
        : () => apiAddComment(selfId, endpoint, tabId, elementId, text, shareCode, mentions, cell),
    remove: (commentId: string) =>
      endpoint === null
        ? undefined
        : () => apiDeleteComment(selfId, endpoint, tabId, commentId, shareCode),
    // A thread is named by its first comment.
    threadState: (thread: Thread, resolved: boolean) => {
      const first = thread?.comments[0]?.id;
      if (endpoint === null || !first) return undefined;
      return () => apiSetThreadResolved(selfId, endpoint, tabId, first, resolved, shareCode);
    },
    // A reaction (docs/specs/012-collaboration/comment-reactions.md), under this browser's collab key.
    react: (commentId: string, reaction: { emoji: string; on: boolean; key: string }) =>
      endpoint === null
        ? undefined
        : () => apiReactToComment(selfId, endpoint, tabId, commentId, reaction, shareCode),
  };
}
