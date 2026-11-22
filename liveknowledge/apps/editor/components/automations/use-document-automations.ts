'use client';

// Who gets the document's Automations, and the document they get (docs/specs/013-workspace/automations.md "Share
// roles"; blueprint automations.md "Editor", "The door"): a signed-in Editor of the whole document saved to an account
// opens the screen; an Editor who must first sign in, or sync a document kept Offline, opens the gate; a one-tab link,
// a Participant, a Viewer, an embed and a workbench frame see no row at all. Gated on the session's `can` and the
// structure lock (true for a one-tab link), never on read-only alone. The api refuses everyone but an Editor of the
// whole document all the same (403 `automations_need_editor`), so this is presentation. Light: the editor view calls
// it on every render.

import { useMemo } from 'react';
import { automationsScopeFor } from '@liveworkspace/automations-ui/automations-gate';
import { useAutomationsGate } from '@liveworkspace/automations-ui/use-automations-gate';
import type { AutomationsGate } from '@liveworkspace/automations-ui/AutomationsHost';
import type { AutomationsScope } from '@liveworkspace/automations-ui/kit';
import type { ItemView } from '@liveworkspace/automations-ui/item';
import { useDocumentItemView } from './document-item';

// The editor context's parts this reads (EditorContext).
export type DocumentAutomationsContext = {
  can: { level: string };
  isStructureReadOnly: boolean;
  hydrated: boolean;
  embedMode: boolean;
  workbench: unknown;
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  authLoaded: boolean;
  selfParticipant: { id: string } | null | undefined;
  documentId: string | null;
  documentName: string | null | undefined;
  tabs: readonly { id: string; name: string }[];
  activeId: string | null;
  sessionShareCode: string | null;
  sessionTabScope: string | null;
  syncToCloud: () => Promise<void>;
  commentMentions: {
    candidates: readonly { userId: string | null; name: string; pending?: boolean }[];
  };
};

export type DocumentAutomations = {
  scope: AutomationsScope | null;
  gate: AutomationsGate | null;
  signedIn: boolean;
  item: ItemView | null;
};

/** The badges the Tools row wears while a gate stands, in History's words: Sign In, then Sync Knowledgebase. */
export const automationsBadges = (signedIn: boolean, offline: boolean): readonly string[] => [
  ...(signedIn ? [] : ['Sign In']),
  ...(offline ? ['Sync Knowledgebase'] : []),
];

export function useDocumentAutomations(
  ctx: DocumentAutomationsContext,
  isOffline: boolean,
  selectTab: (tabId: string) => void,
): DocumentAutomations {
  const signedIn = !!ctx.accountUserId;
  // The person asking: known once the participant is ('self' is the placeholder before).
  const selfId = ctx.selfParticipant?.id ?? 'self';
  const ready = selfId !== 'self';
  const { documentId, sessionShareCode, sessionTabScope } = ctx;
  const scopeInput = useMemo(
    () =>
      documentId && ready
        ? {
            ownerId: selfId,
            itemId: documentId,
            shareCode: sessionShareCode,
            tabId: sessionTabScope,
          }
        : null,
    [documentId, ready, selfId, sessionShareCode, sessionTabScope],
  );
  const badges = useMemo(() => automationsBadges(signedIn, isOffline), [signedIn, isOffline]);
  const gateInput = {
    level: ctx.can.level,
    structureReadOnly: ctx.isStructureReadOnly,
    offline: isOffline,
    hydrated: ctx.hydrated,
    // A workbench frame reaches no Automations route (its allow-list confines them), so it reads no rules either.
    embed: ctx.embedMode || !!ctx.workbench,
    signedIn,
    authLoaded: ctx.authLoaded,
    scope: scopeInput,
  };
  // The same scope while what it reads is the same: the host's list and the open screen key on it.
  const { level, structureReadOnly, hydrated, embed, authLoaded } = gateInput;
  // Who the list is asked as: a list refused for one account is read again for another.
  const viewer = ctx.accountUserId ?? null;
  const scope = useMemo(
    () =>
      automationsScopeFor({
        level,
        structureReadOnly,
        offline: isOffline,
        hydrated,
        embed,
        signedIn,
        authLoaded,
        viewer,
        scope: scopeInput,
      }),
    [
      level,
      structureReadOnly,
      isOffline,
      hydrated,
      embed,
      signedIn,
      authLoaded,
      viewer,
      scopeInput,
    ],
  );
  const gate = useAutomationsGate({ ...gateInput, ready, sync: ctx.syncToCloud, badges });
  const accountId = ctx.accountUserId ?? null;
  const accountName = ctx.accountDisplayName?.trim() || 'You';
  const self = useMemo(
    () => (accountId ? { id: accountId, name: accountName } : null),
    [accountId, accountName],
  );
  const item = useDocumentItemView({
    documentId,
    documentName: ctx.documentName,
    tabs: ctx.tabs,
    activeId: ctx.activeId,
    self,
    team: ctx.commentMentions.candidates,
    shareCode: sessionShareCode,
    openTab: selectTab,
  });
  return { scope, gate, signedIn, item };
}
