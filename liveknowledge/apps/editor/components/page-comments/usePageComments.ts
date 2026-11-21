'use client';

// The comments at the current page's foot for the editor (docs/specs/030-knowledgebase/page-comments.md): the page's
// threads (read once a page a session, after the page has drawn), whether the person here may write, their own
// collab key (which comments are theirs) and `change`, optimistic with a toast in words on a refusal. Reads the
// chrome store one slice at a time and the threads store by its version: typing renders nothing here.
import { guestName } from '@liveknowledge/knowledge';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PageThreadChange } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { commentFailureText } from '@/lib/knowledge/page-feedback-words';
import { ownCommentKey } from '@/lib/page-threads/own-comment-key';
import { pageThreadsStore, type PageThreadsEntry } from '@/lib/page-threads/page-threads-store';
import { track } from '@/lib/telemetry';

// The editor's comment events, typed "Page" for a page's foot (lib/telemetry-manifest.ts).
function trackChange(change: PageThreadChange): void {
  if (change.op === 'start' || change.op === 'reply') track('Comment', 'Added', 'Page');
  else if (change.op === 'resolve') track('Comment', 'Resolved', 'Page');
  else if (change.op === 'reopen') track('Comment', 'Unresolved', 'Page');
  else if (change.op === 'delete') track('Comment', 'Deleted', 'Page');
  else track('UI', 'Used', 'EditPageComment');
}

export type PageCommentsView = {
  pageId: string;
  entry: PageThreadsEntry;
  /** Start, reply, resolve, reopen, and edit and delete one's own: an Editor's and a Participant's. */
  canWrite: boolean;
  /** The person's collab key, once derived: their comments carry it. */
  ownKey: string | null;
  /** Resolves true once the api took the change; a refusal is toasted and resolves false. */
  change: (change: PageThreadChange) => Promise<boolean>;
  /** Hidden: a knowledgebase kept Offline has no room, and nothing outside the editor's store. */
  hidden: boolean;
};

export function usePageComments(): PageCommentsView {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const takePart = useEditorChrome((s) => s.can.takePart);
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const offline = useIsOfflineDocument(documentId);
  const at = useSyncExternalStore(
    pageThreadsStore.subscribe,
    pageThreadsStore.version,
    pageThreadsStore.version,
  );
  const [ownKey, setOwnKey] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (selfId) void ownCommentKey(selfId).then((key) => live && setOwnKey(key));
    return () => {
      live = false;
    };
  }, [selfId]);
  useEffect(() => {
    if (!documentId || offline) return;
    const editor = chrome.get();
    // After the page has drawn: a read on its own, never on the writing's render path.
    const handle = window.setTimeout(() => {
      void pageThreadsStore.load(
        { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
        documentId,
        pageId,
      );
    }, 0);
    return () => window.clearTimeout(handle);
  }, [chrome, documentId, pageId, offline]);
  const entry = pageThreadsStore.entryOf(documentId ?? '', pageId, at);
  const canWrite = takePart && !offline;
  const change = useCallback(
    async (next: PageThreadChange): Promise<boolean> => {
      const editor = chrome.get();
      if (!editor.documentId || !canWrite) return false;
      const self = editor.selfParticipant;
      // A guest's comment carries the name on their cursor; a signed-in person's is their profile's.
      const withName =
        (next.op === 'start' || next.op === 'reply') && !editor.accountUserId && self.name
          ? { ...next, name: self.name }
          : next;
      try {
        await pageThreadsStore.change(
          { ownerId: self.id, shareCode: editor.sessionShareCode },
          editor.documentId,
          editor.activeId,
          withName,
          {
            by: ownKey ?? '',
            // As the api records it: a guest's name says "(Guest)" after it.
            name: editor.accountUserId ? self.name || 'You' : guestName(self.name),
            color: self.color,
          },
          Date.now(),
        );
        trackChange(next);
        return true;
      } catch (err) {
        toast.error(commentFailureText(err, next.op));
        return false;
      }
    },
    [chrome, canWrite, ownKey, toast],
  );
  return useMemo(
    () => ({ pageId, entry, canWrite, ownKey, change, hidden: offline || !documentId }),
    [pageId, entry, canWrite, ownKey, change, offline, documentId],
  );
}
