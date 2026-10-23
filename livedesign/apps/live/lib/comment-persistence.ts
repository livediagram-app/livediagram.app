import type { CommentMention } from '@livedesign/design';
import { apiAddComment, apiDeleteComment, apiSetThreadResolved } from '@/lib/api-client';

// How a comment change is kept (docs/specs/008-canvas/canvas-and-palette.md "Comments", docs/specs/013-workspace/share-roles.md):
// an Editor's rides the room and the tab autosave; a read-only session (a Participant, or a Viewer the popover lets
// read) has no autosave, so its add, delete, resolve and reopen go through the dedicated comment endpoints. Shared by
// every surface that drives the thread machinery, so none of them can forget it: the Comment panel did, and a
// Participant's panel comment stayed on their own screen, unsaved and unseen by anyone else.
export type CommentSession = {
  readOnly: boolean;
  designId: string | null;
  tabId: string;
  selfId: string;
  shareCode: string | null;
};

type Thread = { comments: readonly { id: string }[] } | undefined;

export function commentPersisters(session: CommentSession) {
  const { readOnly, designId, tabId, selfId, shareCode } = session;
  const endpoint = readOnly && designId !== null ? designId : null;
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
  };
}
