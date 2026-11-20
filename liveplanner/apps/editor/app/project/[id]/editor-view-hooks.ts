'use client';

// EditorView's own hooks, each one concern read from the editor's context: the header's Community state, the
// guest sign-in toast, the canvas style the covers draw, and Automations' scope and gate.
import {
  emailIntakeGateFor,
  emailIntakeScopeFor,
  type EmailIntakeScope,
} from '@/components/email-intake/email-intake-gate';
import { useCallback, useMemo } from 'react';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import {
  itemIsPublic,
  useAutoCopyParam,
  useCommunityState,
} from '@liveworkspace/community-ui/editor';
import { useSignInToast as useSharedSignInToast } from '@liveworkspace/workbench/hooks/ui/useSignInToast';
import { useItemSnapshotsDoor } from '@liveworkspace/snapshots/ui';
import { API_BASE } from '@/lib/api-client';
import { apiFetch, apiHeaders } from '@/lib/api/core';
import type { resolveViewBackdrop } from '@/lib/view-backdrop';
import { automationsScopeFor } from '@/components/automations/automations-gate';
import { useAutomationsGate } from '@/components/automations/use-automations-gate';
import { useToolGate } from '@/components/dialogs/tool-gate';
import {
  calendarFeedGateFor,
  calendarFeedScopeFor,
  type CalendarFeedScope,
} from '@/components/calendar-feed/calendar-feed-gate';
import { roadmapScopeFor, type RoadmapScope } from '@/components/roadmap/roadmap-gate';
import type { useEditorContext } from './EditorContext';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// Whether the plan shows as public on the Community, for the header's share state; and a Community link's
// `?copy=1` acted on.
export function useHeaderCommunity(ctx: EditorContextValue): boolean {
  const { projectId, appChrome, hydrated, sessionShareCode, sessionCommunity, makeCopy } = ctx;
  // The header badge follows the plan's Community post (docs/specs/025-community/community.md "Publishing").
  const communityState = useCommunityState(projectId);
  // The badge goes too while the Community is switched off. Asked only while there is a listed post to badge, and
  // never in an embed, so other opens make no request.
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && appChrome);
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md "The gallery").
  useAutoCopyParam({
    hydrated,
    sessionShareCode,
    // The author's own post copies nothing: their bar offers Edit Your Plan instead.
    community: sessionCommunity !== null && !sessionCommunity.ownProjectId,
    makeCopy,
  });
  // Whether the plan shows as public on the Community, for the header's share state.
  const headerCommunity = itemIsPublic({
    communityOn,
    ownPostState: communityState,
    communitySession: sessionCommunity !== null,
  });
  return headerCommunity;
}

// The guest sign-in toast, delayed into the session (the shared useSignInToast), hidden in zen mode. Its dismiss key
// is the banner's it replaced, so whoever closed that stays rid of it.
export function useSignInToast(ctx: EditorContextValue): void {
  const { accountUserId, appChrome, zenMode } = ctx;
  useSharedSignInToast({
    dismissKey: 'liveplanner:signin-banner-dismissed:v1',
    accountUserId,
    appChrome,
    hidden: zenMode,
  });
}

// The canvas style, for the pages that cover the canvas and must draw its motion themselves.
export function useCanvasPattern(
  activeTab: EditorContextValue['activeTab'],
  backdrop: ReturnType<typeof resolveViewBackdrop>,
) {
  const patternScale = activeTab.backgroundPatternScale ?? 1;
  const patternSpeed = activeTab.backgroundAnimationSpeed ?? 1;
  const canvasPattern = useMemo(
    () => ({
      pattern: backdrop.backgroundPattern ?? 'grid',
      color: backdrop.patternColor,
      scale: patternScale,
      speed: patternSpeed,
      opacity: backdrop.backgroundOpacity ?? 1,
    }),
    [
      backdrop.backgroundPattern,
      backdrop.patternColor,
      backdrop.backgroundOpacity,
      patternScale,
      patternSpeed,
    ],
  );
  return canvasPattern;
}

// Subscribe to Calendar (docs/specs/026-plan/calendar-feed.md "Where it lives"): its scope for the plan's owner or a
// team member, signed in, on a plan saved to an account; else the gate (Sign In, Sync Plan) for one who would have it
// but for that, so Tools always shows it.
export function useEditorCalendarFeed(ctx: EditorContextValue, isOffline: boolean) {
  const input = {
    hydrated: ctx.hydrated,
    embed: ctx.embedMode,
    workbench: !!ctx.workbench,
    offline: isOffline,
    signedIn: !!ctx.accountUserId,
    authLoaded: ctx.authLoaded,
    scope: ctx.plan.context?.itemsScope ?? null,
  };
  const calendarFeedScope: CalendarFeedScope | null = calendarFeedScopeFor(input);
  const calendarFeedGate = useToolGate(
    calendarFeedScope ? null : calendarFeedGateFor(input),
    ctx.selfParticipant.id !== 'self',
    ctx.syncToCloud,
    input,
  );
  return { calendarFeedScope, calendarFeedGate };
}

// Publish Roadmap's scope (docs/specs/026-plan/public-roadmap.md "Who may publish"): the plan's owner or a team
// member on a plan saved to the server, a guest owner included; null (no tab menu row) for everyone else.
export function useEditorRoadmap(ctx: EditorContextValue, isOffline: boolean): RoadmapScope | null {
  return roadmapScopeFor({
    hydrated: ctx.hydrated,
    embed: ctx.embedMode,
    workbench: !!ctx.workbench,
    offline: isOffline,
    scope: ctx.plan.context?.itemsScope ?? null,
  });
}

// Email to Board (docs/specs/026-plan/email-to-board.md "Who may manage an address"): its scope for an Editor of the
// whole plan, signed in, on a plan saved to the server; else the gate (Sign In, Sync Plan) for that Editor.
export function useEditorEmailIntake(ctx: EditorContextValue, isOffline: boolean) {
  const input = {
    level: ctx.can.level,
    signedIn: !!ctx.accountUserId,
    authLoaded: ctx.authLoaded,
    hydrated: ctx.hydrated,
    embed: ctx.embedMode,
    workbench: !!ctx.workbench,
    offline: isOffline,
    scope: ctx.plan.context?.itemsScope ?? null,
  };
  const emailIntakeScope: EmailIntakeScope | null = emailIntakeScopeFor(input);
  const emailIntakeGate = useToolGate(
    emailIntakeScope ? null : emailIntakeGateFor(input),
    ctx.selfParticipant.id !== 'self',
    ctx.syncToCloud,
    input,
  );
  return { emailIntakeScope, emailIntakeGate };
}

export function useEditorAutomations(ctx: EditorContextValue, isOffline: boolean) {
  const { isStructureReadOnly, hydrated, embedMode, accountUserId } = ctx;
  // Automations (docs/specs/026-plan/automations.md "Who may do what"): a signed-in Editor of the whole plan saved to
  // an account opens the screen; one who could edit it but for a plan kept Offline or no account opens the gate.
  const automationsGateInput = {
    level: ctx.can.level,
    structureReadOnly: isStructureReadOnly,
    offline: isOffline,
    hydrated,
    // A workbench frame reaches no Automations route (its allow-list confines them), so it reads no rules either.
    embed: embedMode || ctx.workbenchMode,
    signedIn: !!accountUserId,
    authLoaded: ctx.authLoaded,
    scope: ctx.plan.context?.itemsScope ?? null,
  };
  const automationsScope = automationsScopeFor(automationsGateInput);
  const automationsGate = useAutomationsGate({
    ...automationsGateInput,
    ready: ctx.selfParticipant.id !== 'self',
    sync: ctx.syncToCloud,
  });
  return { automationsScope, automationsGate };
}

// Snapshots (docs/specs/013-workspace/snapshots.md "In the editor"): an Editor of the whole plan stored on the server,
// never Offline or an embed. The api answers everyone else 404 all the same, so this is presentation.
export function useEditorSnapshots(ctx: EditorContextValue, isOffline: boolean) {
  const scope = ctx.plan.context?.itemsScope ?? null;
  const allowed =
    ctx.hydrated &&
    !isOffline &&
    !ctx.embedMode &&
    !ctx.isStructureReadOnly &&
    ctx.can.level === 'edit' &&
    scope !== null &&
    scope.tabId === null;
  const ownerId = scope?.ownerId ?? '';
  const shareCode = scope?.shareCode ?? null;
  const headers = useCallback(
    (opts: { body?: boolean }) => apiHeaders(ownerId, { share: shareCode, body: opts.body }),
    [ownerId, shareCode],
  );
  return useItemSnapshotsDoor({
    allowed,
    itemUrl: scope ? `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}` : null,
    noun: 'plan',
    viewerId: ctx.selfParticipant.id,
    apiFetch,
    apiHeaders: headers,
  });
}
