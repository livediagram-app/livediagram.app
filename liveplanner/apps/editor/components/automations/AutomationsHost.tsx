'use client';

// Gives the editor its Automations (AutomationsContext) and draws the screen while it is open. The screen's code
// loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose Editor never opens it
// pays nothing for it; the list itself is read a moment after the plan opens, for the footer's amber dot.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import type { AutomationsScope } from './automations-client';
import {
  AutomationsContext,
  type AutomationsAccess,
  type AutomationsTarget,
} from './AutomationsContext';
import { readAutomations } from './use-automations';

const AutomationsDialog = dynamic(
  () => import('./AutomationsDialog').then((m) => m.AutomationsDialog),
  { ssr: false },
);

// How long after the plan opens the list is read for the dot: past the plan's own first load.
export const AUTOMATIONS_FIRST_READ_MS = 3000;

export function AutomationsHost({
  scope,
  plan,
  children,
}: {
  // The plan the screen's pickers read: the host sits above the footer, outside the canvas's PlanProvider.
  plan: PlanContextValue | undefined;
  // Null for anyone but an Editor of the whole plan saved to an account (automationsScopeFor).
  scope: AutomationsScope | null;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<AutomationsTarget | null>(null);
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
  return (
    <AutomationsContext.Provider value={value}>
      {children}
      {value && target ? (
        <PlanProvider value={plan}>
          <AutomationsDialog
            scope={value.scope}
            target={target}
            onTarget={setTarget}
            onClose={() => setTarget(null)}
          />
        </PlanProvider>
      ) : null}
    </AutomationsContext.Provider>
  );
}
