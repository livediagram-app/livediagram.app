'use client';

// Gives the editor its Automations (AutomationsContext) and draws the screen while it is open. The screen's code
// loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose Editor never opens it
// pays nothing for it; the list itself is read a moment after the plan opens, for the footer's amber dot. On a plan in
// This Browser, or for a guest, it gives the footer its button alone, which opens the Share-style gate
// (AutomationsSyncGate, its own chunk): Sync Plan, or Sign In; once synced or signed in the same opening goes on to the
// screen, as Share goes on to sharing. `?automations=1` (where a guest's sign-in comes back) opens it on arrival, and
// `#github=…` (where Connect GitHub comes back) opens it at the GitHub view, or at the rule kept for the round trip.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import type { AutomationsScope } from './automations-client';
import {
  AutomationsContext,
  AutomationsDoorContext,
  type AutomationsAccess,
  type AutomationsDoor,
  type AutomationsTarget,
} from './AutomationsContext';
import { AUTOMATIONS_PARAM } from './automations-gate';
import { readAutomations } from './use-automations';
import {
  dropGithubHash,
  githubResultOf,
  takeGithubDraft,
  trackGithubResult,
  type GithubResult,
} from './github/github-hash';

const AutomationsDialog = dynamic(
  () => import('./AutomationsDialog').then((m) => m.AutomationsDialog),
  { ssr: false },
);
const AutomationsSyncGate = dynamic(
  () => import('./AutomationsSyncGate').then((m) => m.AutomationsSyncGate),
  { ssr: false },
);

// What stands before the screen (automationsGateFor): a plan in This Browser syncs (the Sync Plan move, once the
// reader is known); a guest on a server plan signs in.
export type AutomationsGate =
  { kind: 'sync'; ready: boolean; sync: () => Promise<void> } | { kind: 'sign_in' };

/** Whether this page was opened asking for the screen (`?automations=1`), as `?share=1` opens Share. */
const askedOpen = () => new URL(window.location.href).searchParams.get(AUTOMATIONS_PARAM) === '1';

// How long after the plan opens the list is read for the dot: past the plan's own first load.
export const AUTOMATIONS_FIRST_READ_MS = 3000;

export function AutomationsHost({
  scope,
  plan,
  gate = null,
  planName = '',
  signedIn = false,
  children,
}: {
  // The plan the screen's pickers read: the host sits above the footer, outside the canvas's PlanProvider.
  plan: PlanContextValue | undefined;
  // Null for anyone but an Editor of the whole plan saved to an account (automationsScopeFor).
  scope: AutomationsScope | null;
  // Set for someone who could edit the plan but must sync it or sign in first (automationsGateFor).
  gate?: AutomationsGate | null;
  // The plan's name, for its Webhooks dialog; whether the person is signed in (webhooks are an account's).
  planName?: string;
  signedIn?: boolean;
  children: ReactNode;
}) {
  // Back from a guest's sign-in: open on the rules, then drop the ask so a refresh doesn't reopen it.
  const [target, setTarget] = useState<AutomationsTarget | null>(() =>
    askedOpen() ? { view: 'rules' } : null,
  );
  useEffect(() => {
    if (!askedOpen()) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(AUTOMATIONS_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);
  // Back from GitHub: read before anything rewrites the address, then dropped from it (for anyone: a Viewer who
  // followed the link gets a clean address and no screen).
  const [github, setGithub] = useState<GithubResult | null>(() =>
    githubResultOf(window.location.hash),
  );
  useEffect(() => {
    dropGithubHash();
  }, []);
  const { ownerId, projectId, shareCode } = scope ?? {};
  const stable = useMemo<AutomationsScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId, shareCode: shareCode ?? null } : null),
    [ownerId, projectId, shareCode],
  );
  const githubDraft = useRef<AutomationRuleBody | null | undefined>(undefined);
  // The screen at the GitHub view (or the rule kept), once the plan's Editor scope is known.
  useEffect(() => {
    if (!github || !stable) return;
    // oxlint-disable-next-line react/set-state-in-effect -- a one-shot return from GitHub, taken once the Editor scope arrives
    setGithub(null);
    trackGithubResult(github);
    // Taken once per mount: an effect run again (React's Strict Mode in development) must find the same rule, not
    // the empty slot the first run left.
    if (githubDraft.current === undefined) githubDraft.current = takeGithubDraft(stable.projectId);
    const draft = githubDraft.current;
    setTarget(
      draft ? { view: 'rule', ruleId: null, draft, github } : { view: 'github', result: github },
    );
    track('UI', 'Opened', 'Automations');
  }, [github, stable]);
  // The list for the dot, once the plan has settled.
  useEffect(() => {
    if (!stable) return;
    const timer = setTimeout(() => void readAutomations(stable), AUTOMATIONS_FIRST_READ_MS);
    return () => clearTimeout(timer);
  }, [stable]);
  const open = useCallback((at: AutomationsTarget = { view: 'rules' }) => {
    setTarget(at);
    track('UI', 'Opened', 'Automations');
  }, []);
  const value = useMemo<AutomationsAccess | null>(
    () => (stable ? { scope: stable, open } : null),
    [stable, open],
  );
  const gateKind = gate?.kind ?? null;
  const door = useMemo<AutomationsDoor | null>(() => {
    if (stable) return { open: () => open(), offline: false };
    if (!gateKind) return null;
    return {
      // The screen's own target: once the plan is synced, the scope arrives and the screen opens on it.
      open: () => {
        setTarget({ view: 'rules' });
        track('UI', 'Opened', gateKind === 'sync' ? 'AutomationsOffline' : 'AutomationsSignIn');
      },
      offline: true,
    };
  }, [stable, open, gateKind]);
  return (
    <AutomationsDoorContext.Provider value={door}>
      <AutomationsContext.Provider value={value}>
        {children}
        {value && target ? (
          <PlanProvider value={plan}>
            <AutomationsDialog
              scope={value.scope}
              target={target}
              onTarget={setTarget}
              onClose={() => setTarget(null)}
              planName={planName}
              signedIn={signedIn}
            />
          </PlanProvider>
        ) : null}
        {gate && !stable && target ? (
          <AutomationsSyncGate gate={gate} onClose={() => setTarget(null)} />
        ) : null}
      </AutomationsContext.Provider>
    </AutomationsDoorContext.Provider>
  );
}
