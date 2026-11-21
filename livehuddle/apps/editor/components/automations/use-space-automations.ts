'use client';

// Who gets the Space's Automations, and the Space they get (docs/specs/013-workspace/automations.md "Share roles";
// blueprint automations.md "Editor", "The door"): a signed-in Editor of the whole Space saved to an account opens the
// screen; an Editor who must first sign in, or sync a Space kept Offline, opens the gate; a one-tab link, a
// Participant, a Viewer and an embed see no row at all. Gated on the session's `can` and the structure lock (true
// for a one-tab link), never on read-only alone. The api refuses everyone but an Editor of the whole Space all the
// same (403 `automations_need_editor`), so this is presentation. Light: the editor view calls it on every render.

import { useMemo } from 'react';
import { automationsScopeFor } from '@liveworkspace/automations-ui/automations-gate';
import { useAutomationsGate } from '@liveworkspace/automations-ui/use-automations-gate';
import type { AutomationsGate } from '@liveworkspace/automations-ui/AutomationsHost';
import type { AutomationsScope } from '@liveworkspace/automations-ui/kit';
import { useSpaceItemView, useSpaceTeam, type SpaceItem } from './space-item';

// The editor context's parts this reads (EditorContext).
export type SpaceAutomationsContext = {
  can: { level: string };
  isStructureReadOnly: boolean;
  hydrated: boolean;
  embedMode: boolean;
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
  // The account's teams (its token's), and the team the Space is filed in: whose people a rule may name.
  teams: readonly { id: string; name: string }[];
  documentTeamId: string | null | undefined;
};

export type SpaceAutomations = {
  scope: AutomationsScope | null;
  gate: AutomationsGate | null;
  signedIn: boolean;
  item: SpaceItem;
};

/** The badges the Tools row wears while a gate stands, in History's words: Sign In, then Sync Space. */
export const automationsBadges = (signedIn: boolean, offline: boolean): readonly string[] => [
  ...(signedIn ? [] : ['Sign In']),
  ...(offline ? ['Sync Space'] : []),
];

export function useSpaceAutomations(
  ctx: SpaceAutomationsContext,
  isOffline: boolean,
  selectTab: (tabId: string) => void,
): SpaceAutomations {
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
    // livehuddle has no workbench frame: an embed alone reads no rules.
    embed: ctx.embedMode,
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
  const view = useSpaceItemView({
    documentId,
    documentName: ctx.documentName,
    tabs: ctx.tabs,
    activeId: ctx.activeId,
    self,
    shareCode: sessionShareCode,
    openTab: selectTab,
  });
  // The team is read only while the screen is open, so the door hands it over for that alone.
  const team = useSpaceTeam(ctx.accountUserId, ctx.teams, ctx.documentTeamId);
  const item = useMemo<SpaceItem>(() => ({ view, team }), [view, team]);
  return { scope, gate, signedIn, item };
}
