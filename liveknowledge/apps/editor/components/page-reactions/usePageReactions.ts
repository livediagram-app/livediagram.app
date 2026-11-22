'use client';

// The current page's reactions for the editor (docs/specs/030-knowledgebase/page-reactions.md): the page's reactions
// (read once a page a session, after the page has drawn), whether the person here may react (any signed-in reader,
// a Viewer too; never a guest), their collab key (which reactions are theirs) and `toggle`, shown at once with a
// toast in words on a refusal. Reads the chrome store one slice at a time and the reactions store by its version:
// typing renders nothing here, and a reaction renders nothing else.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { reactionFailureText } from '@/lib/knowledge/page-feedback-words';
import { ownCommentKey } from '@/lib/page-threads/own-comment-key';
import {
  pageReactionsStore,
  type PageReactionsEntry,
} from '@/lib/page-reactions/page-reactions-store';
import {
  hasPageReaction,
  reactionGroupsOf,
  type PageReactionGroup,
} from '@/lib/page-reactions/reaction-groups';

export type PageReactionsView = {
  entry: PageReactionsEntry;
  groups: readonly PageReactionGroup[];
  /** Add or take back one's own: any signed-in reader's (the api's rule, page-reactions.md "Share roles"). */
  canReact: boolean;
  /** The person's own name, so who reacted reads "You" in its place. */
  selfName: string;
  /** Press an emoji: adds yours, or takes it back when you already reacted with it. */
  toggle: (emoji: string) => void;
  /** Hidden: a knowledgebase kept Offline has no room. */
  hidden: boolean;
};

export function usePageReactions(): PageReactionsView {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const selfName = useEditorChrome((s) => s.selfParticipant.name);
  const signedIn = useEditorChrome((s) => !!s.accountUserId || !!s.workbench);
  const offline = useIsOfflineDocument(documentId);
  const at = useSyncExternalStore(
    pageReactionsStore.subscribe,
    pageReactionsStore.version,
    pageReactionsStore.version,
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
    const who = { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode };
    // After the page has drawn: a read on its own, never on the writing's render path.
    const handle = window.setTimeout(
      () => void pageReactionsStore.load(who, documentId, pageId),
      0,
    );
    return () => window.clearTimeout(handle);
  }, [chrome, documentId, pageId, offline]);
  const entry = pageReactionsStore.entryOf(documentId ?? '', pageId, at);
  const groups = useMemo(() => reactionGroupsOf(entry.reactions, ownKey), [entry, ownKey]);
  const canReact = signedIn && !offline && ownKey !== null;
  const toggle = useCallback(
    (emoji: string) => {
      const editor = chrome.get();
      if (!editor.documentId || !canReact || ownKey === null) return;
      const self = editor.selfParticipant;
      const held = pageReactionsStore.entryOf(editor.documentId, editor.activeId).reactions;
      const on = !hasPageReaction(held, emoji, ownKey);
      pageReactionsStore
        .toggle(
          { ownerId: self.id, shareCode: editor.sessionShareCode },
          editor.documentId,
          editor.activeId,
          { emoji, by: ownKey, name: self.name.trim() || 'Someone' },
          on,
        )
        .catch((err: unknown) => toast.error(reactionFailureText(err, on)));
    },
    [chrome, canReact, ownKey, toast],
  );
  return useMemo(
    () => ({ entry, groups, canReact, selfName, toggle, hidden: offline || !documentId }),
    [entry, groups, canReact, selfName, toggle, offline, documentId],
  );
}
