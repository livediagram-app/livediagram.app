'use client';

// EditorView's own hooks, each one concern read from the editor's context: the header's Community state, the
// guest sign-in nudge, the canvas style the covers draw, and Automations' scope and gate.
import { useMemo } from 'react';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import {
  itemIsPublic,
  useAutoCopyParam,
  useCommunityState,
} from '@liveworkspace/community-ui/editor';
import { useDismissibleBanner } from '@liveworkspace/workbench/hooks/ui/useDismissibleBanner';
import { useDelayedReveal } from '@liveworkspace/workbench/hooks/ui/useDelayedReveal';
import { API_BASE } from '@/lib/api-client';
import type { resolveViewBackdrop } from '@/lib/view-backdrop';
import { SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { automationsScopeFor } from '@/components/automations/automations-gate';
import { useAutomationsGate } from '@/components/automations/use-automations-gate';
import type { useEditorContext } from './EditorContext';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// How long a guest edits before the sign-in nudge appears (docs/specs/014-identity/sign-in-encouragement.md).
// Long enough that it never greets someone the instant they open a
// project; short enough to catch an invested session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

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

export function useSignInNudge(ctx: EditorContextValue): {
  showSignInBanner: boolean;
  dismissSignIn: () => void;
} {
  const { accountUserId, appChrome, zenMode } = ctx;
  // Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md): the same banner the Explorer shows,
  // but on the editor it waits ~5 minutes into the session before
  // appearing so it never interrupts someone the moment they open a
  // project. Hidden in embed (read-only iframe) and zen mode. zenMode
  // is deliberately kept OUT of the timer's `enabled` so toggling zen
  // doesn't restart the countdown; it only hides the card at render.
  const { dismissed: signInDismissed, dismiss: dismissSignIn } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const signInTimerEnabled = !accountUserId && appChrome && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !zenMode && signInDelayElapsed;
  return { showSignInBanner, dismissSignIn };
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

export function useEditorAutomations(ctx: EditorContextValue, isOffline: boolean) {
  const { isStructureReadOnly, hydrated, embedMode, accountUserId } = ctx;
  // Automations (docs/specs/026-plan/automations.md "Who may do what"): a signed-in Editor of the whole plan saved to
  // an account opens the screen; one who could edit it but for a plan in This Browser or no account opens the gate.
  const automationsGateInput = {
    level: ctx.can.level,
    structureReadOnly: isStructureReadOnly,
    offline: isOffline,
    hydrated,
    embed: embedMode,
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
