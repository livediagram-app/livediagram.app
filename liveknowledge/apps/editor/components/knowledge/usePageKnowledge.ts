'use client';

// A page's knowledge for the editor's chrome (docs/specs/030-knowledgebase/verification.md): the fields, the state
// the clock gives them, Page Health once read, who may change them, the names the editor knows, and the actions,
// each optimistic with a toast on a refusal. Reads the chrome store one slice at a time, so a typing commit renders
// nothing here.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { PageHealthResponse, PageKnowledgePatch } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { knowledgeRights, type KnowledgeRights } from '@/lib/knowledge/knowledge-rights';
import { knowledgeFailureText, type KnowledgeAction } from '@/lib/knowledge/knowledge-words';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { pageTrust, type PageTrust } from '@/lib/knowledge/page-trust';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';

export type KnowledgePerson = { id: string; name: string };

/** The people the editor can name: the person here, and the team whose library holds the knowledgebase. */
export function useKnowledgePeople(): {
  people: readonly KnowledgePerson[];
  nameOf: (id: string | undefined) => string | undefined;
} {
  const accountUserId = useEditorChrome((s) => s.accountUserId ?? null);
  const selfName = useEditorChrome((s) => s.selfParticipant.name);
  const candidates = useEditorChrome((s) => s.commentMentions.candidates);
  return useMemo(() => {
    const people: KnowledgePerson[] = [];
    if (accountUserId) people.push({ id: accountUserId, name: selfName || 'You' });
    for (const person of candidates) {
      if (person.userId && !person.pending && person.userId !== accountUserId)
        people.push({ id: person.userId, name: person.name });
    }
    const names = new Map(people.map((p) => [p.id, p.name]));
    return { people, nameOf: (id) => (id ? names.get(id) : undefined) };
  }, [accountUserId, selfName, candidates]);
}

export type KnowledgeActions = {
  rights: KnowledgeRights;
  verify: (pageId: string) => void;
  setFields: (pageId: string, patch: PageKnowledgePatch, action: KnowledgeAction) => void;
};

/** Verify and the fields, for any page of the knowledgebase (the meta row, Page Health, the tree's row menu). */
export function useKnowledgeActions(): KnowledgeActions {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const editPages = useEditorChrome((s) => s.can.editPages);
  const isStructureReadOnly = useEditorChrome((s) => s.isStructureReadOnly);
  const accountUserId = useEditorChrome((s) => s.accountUserId ?? null);
  const rights = useMemo(
    () => knowledgeRights({ can: { editPages }, isStructureReadOnly, accountUserId, offline }),
    [editPages, isStructureReadOnly, accountUserId, offline],
  );
  const callerOf = useCallback((): { who: KnowledgeCaller; documentId: string } | null => {
    const editor = chrome.get();
    if (!editor.documentId) return null;
    return {
      who: { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      documentId: editor.documentId,
    };
  }, [chrome]);
  const verify = useCallback(
    (pageId: string) => {
      const editor = chrome.get();
      const caller = callerOf();
      const page = editor.tabs.find((t) => t.id === pageId);
      if (!rights.verify || !caller || !page || !editor.accountUserId) return;
      track('UI', 'Used', 'VerifyPage');
      pageKnowledgeStore
        .verify(caller.who, caller.documentId, page, editor.accountUserId, Date.now())
        .catch((err: unknown) => toast.error(knowledgeFailureText(err, 'verify')));
    },
    [chrome, callerOf, rights.verify, toast],
  );
  const setFields = useCallback(
    (pageId: string, patch: PageKnowledgePatch, action: KnowledgeAction) => {
      const caller = callerOf();
      const page = chrome.get().tabs.find((t) => t.id === pageId);
      if (!rights.editFields || !caller || !page) return;
      pageKnowledgeStore
        .setFields(caller.who, caller.documentId, page, patch, Date.now())
        .catch((err: unknown) => toast.error(knowledgeFailureText(err, action)));
    },
    [chrome, callerOf, rights.editFields, toast],
  );
  return useMemo(() => ({ rights, verify, setFields }), [rights, verify, setFields]);
}

export type PageKnowledgeView = KnowledgeActions & {
  pageId: string;
  trust: PageTrust;
  /** Page Health, once read; absent while loading, on a failure, and for a knowledgebase kept Offline. */
  health: PageHealthResponse | undefined;
  now: number;
};

/** The current page's knowledge. Reads its health when the page opens (once a page for the session). */
export function usePageKnowledge(): PageKnowledgeView {
  const chrome = useEditorChromeStore();
  const actions = useKnowledgeActions();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const stored = useEditorChrome((s) => s.activeTab.knowledge);
  const offline = useIsOfflineDocument(documentId);
  const now = useRelativeNow();
  useSyncExternalStore(
    pageKnowledgeStore.subscribe,
    pageKnowledgeStore.version,
    pageKnowledgeStore.version,
  );
  useEffect(() => {
    if (!documentId || offline) return;
    const editor = chrome.get();
    void pageKnowledgeStore.load(
      { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      documentId,
      pageId,
    );
  }, [chrome, documentId, pageId, offline]);
  const fields = pageKnowledgeStore.fieldsOf({ id: pageId, knowledge: stored });
  const trust = useMemo(() => pageTrust(fields, now), [fields, now]);
  const health = documentId ? pageKnowledgeStore.healthOf(documentId, pageId) : undefined;
  return { ...actions, pageId, trust, health, now };
}
