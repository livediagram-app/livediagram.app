'use client';

// A page's knowledge for the editor's chrome (docs/specs/030-knowledgebase/verification.md): the fields, the state
// the clock gives them, Page Health once read, who may change them, the names the editor knows, and the actions,
// each optimistic with a toast on a refusal. Reads the chrome store one slice at a time, so a typing commit renders
// nothing here.
import { rosterName, usePageSaves } from '@/lib/page-edit/page-edit-store';

// How long after a save Page Health is read again: the save's write to the api lands first.
const HEALTH_AFTER_SAVE_MS = [1500, 5000] as const;
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { PageHealthResponse, PageKnowledgePatch } from '@liveknowledge/api-schema';
import {
  guestName,
  guestVerifier,
  guestVerifierName,
  isGuestVerifier,
  verificationOn,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { knowledgeRights, type KnowledgeRights } from '@/lib/knowledge/knowledge-rights';
import { knowledgeFailureText, type KnowledgeAction } from '@/lib/knowledge/knowledge-words';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { pageTrust, type PageTrust } from '@/lib/knowledge/page-trust';
import { useReviewEvery } from '@/components/knowledge-settings/useReviewEvery';
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
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const candidates = useEditorChrome((s) => s.commentMentions.candidates);
  // Names Page Health reads brought: a new map when one lands, so a name read after first paint shows.
  const healthNames = useSyncExternalStore(
    pageKnowledgeStore.subscribe,
    pageKnowledgeStore.names,
    pageKnowledgeStore.names,
  );
  return useMemo(() => {
    const people: KnowledgePerson[] = [];
    if (accountUserId) people.push({ id: accountUserId, name: selfName || 'You' });
    for (const person of candidates) {
      if (person.userId && !person.pending && person.userId !== accountUserId)
        people.push({ id: person.userId, name: person.name });
    }
    const names = new Map(people.map((p) => [p.id, p.name]));
    return {
      people,
      // A stamp by a guest holds their participant id: named from this guest's own name, or the room's roster, as
      // "Bright Marlin (Guest)" (owner 2026-11-21); a guest no longer here reads "Guest".
      nameOf: (id) => {
        if (!id) return undefined;
        if (isGuestVerifier(id)) return guestVerifierName(id);
        const known = names.get(id) ?? healthNames.get(id);
        if (known) return known;
        if (!accountUserId && id === selfId) return guestName(selfName);
        const seen = rosterName(id);
        return seen ? guestName(seen) : undefined;
      },
    };
  }, [accountUserId, selfName, selfId, candidates, healthNames]);
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
  // Under a Review Period of Never nobody is offered Verify, anywhere it is offered.
  const verifies = verificationOn(useReviewEvery(documentId));
  const rights = useMemo(
    () =>
      knowledgeRights({
        can: { editPages },
        isStructureReadOnly,
        offline,
        verificationOn: verifies,
      }),
    [editPages, isStructureReadOnly, offline, verifies],
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
      if (!rights.verify || !caller || !page) return;
      track('UI', 'Used', 'VerifyPage');
      // A guest verifies too, as "Bright Marlin (Guest)", never made the page's owner (verification.md; the api
      // stamps the same).
      const person = editor.accountUserId ?? guestVerifier(editor.selfParticipant.name);
      pageKnowledgeStore
        .verify(caller.who, caller.documentId, page, person, Date.now())
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
  /** The knowledgebase's Review Period, which `trust` was worked out under. */
  reviewEvery: ReviewEvery;
  /** Page Health, once read; absent while loading, on a failure, and for a knowledgebase kept Offline. */
  health: PageHealthResponse | undefined;
  now: number;
};

/** The current page's knowledge. Reads its health each time the page opens, which counts the person's read. */
export function usePageKnowledge(): PageKnowledgeView {
  const chrome = useEditorChromeStore();
  const actions = useKnowledgeActions();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const stored = useEditorChrome((s) => s.activeTab.knowledge);
  const offline = useIsOfflineDocument(documentId);
  const now = useRelativeNow();
  // The store's version is read into what follows (`at`), never dropped: the React Compiler memoises a call by the
  // values it reads, so a lookup that ignored the version would keep its first answer (Page Health stuck at none).
  const at = useSyncExternalStore(
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
      false,
      // Every open counts the person's read and reads the week's figures again (owner 2026-11-21): Read This Week
      // moves when a page is opened, not only on a reload.
      true,
    );
  }, [chrome, documentId, pageId, offline]);
  // After a save (here or by someone else), read the health again once the save has reached the api: its Updated
  // stamp, editors and badges moved. One read a save, after a short wait for the write.
  const saves = usePageSaves(pageId);
  useEffect(() => {
    if (!documentId || offline || saves === 0) return;
    const read = () => {
      const editor = chrome.get();
      void pageKnowledgeStore.load(
        { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
        documentId,
        pageId,
        true,
      );
    };
    // Twice: a peer's save is told the moment it is pressed, and its write can land after the first read (owner
    // 2026-11-22: Updated stayed until a reload).
    const handles = HEALTH_AFTER_SAVE_MS.map((ms) => window.setTimeout(read, ms));
    return () => handles.forEach((handle) => window.clearTimeout(handle));
  }, [chrome, documentId, pageId, offline, saves]);
  const fields = pageKnowledgeStore.fieldsOf({ id: pageId, knowledge: stored }, at);
  // The knowledgebase's Review Period: a change of it moves the state and the due date at once.
  const every = useReviewEvery(documentId);
  const trust = useMemo(() => pageTrust(fields, every, now), [fields, every, now]);
  const health = documentId ? pageKnowledgeStore.healthOf(documentId, pageId, at) : undefined;
  return { ...actions, pageId, trust, reviewEvery: every, health, now };
}
