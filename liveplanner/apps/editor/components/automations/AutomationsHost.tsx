'use client';

// Gives the editor its Automations (AutomationsContext) and draws the screen while it is open. The screen's code
// loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose Editor never opens it
// pays nothing for it; the list itself is read a moment after the plan opens, for the footer's amber dot. On a plan in
// Browser Storage it gives the footer its button alone, which opens Rules Run on Our Servers (its own chunk).

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { readAutomations } from './use-automations';

const AutomationsDialog = dynamic(
  () => import('./AutomationsDialog').then((m) => m.AutomationsDialog),
  { ssr: false },
);
const AutomationsOfflineDialog = dynamic(
  () => import('./AutomationsOfflineDialog').then((m) => m.AutomationsOfflineDialog),
  { ssr: false },
);

// A plan in Browser Storage: whether its editor sees the button, and how it moves to the account.
export type AutomationsOffline = {
  signedIn: boolean;
  signInHref: string;
  save: () => Promise<void>;
};

// How long after the plan opens the list is read for the dot: past the plan's own first load.
export const AUTOMATIONS_FIRST_READ_MS = 3000;

export function AutomationsHost({
  scope,
  plan,
  offline = null,
  planName = '',
  signedIn = false,
  children,
}: {
  // The plan the screen's pickers read: the host sits above the footer, outside the canvas's PlanProvider.
  plan: PlanContextValue | undefined;
  // Null for anyone but an Editor of the whole plan saved to an account (automationsScopeFor).
  scope: AutomationsScope | null;
  // Set on a plan in Browser Storage its viewer can edit (automationsOfflineFor).
  offline?: AutomationsOffline | null;
  // The plan's name, for its Webhooks dialog; whether the person is signed in (webhooks are an account's).
  planName?: string;
  signedIn?: boolean;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<AutomationsTarget | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const { ownerId, projectId, shareCode } = scope ?? {};
  const stable = useMemo<AutomationsScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId, shareCode: shareCode ?? null } : null),
    [ownerId, projectId, shareCode],
  );
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
  const hasOffline = offline !== null;
  const door = useMemo<AutomationsDoor | null>(() => {
    if (stable) return { open: () => open(), offline: false };
    if (!hasOffline) return null;
    return {
      open: () => {
        setOfflineOpen(true);
        track('UI', 'Opened', 'AutomationsOffline');
      },
      offline: true,
    };
  }, [stable, open, hasOffline]);
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
        {offline && !stable && offlineOpen ? (
          <AutomationsOfflineDialog
            signedIn={offline.signedIn}
            signInHref={offline.signInHref}
            onSave={offline.save}
            onClose={() => setOfflineOpen(false)}
          />
        ) : null}
      </AutomationsContext.Provider>
    </AutomationsDoorContext.Provider>
  );
}
