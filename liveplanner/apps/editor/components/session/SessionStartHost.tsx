'use client';

// Start Planning's Refinement (docs/specs/026-plan/session-tabs.md "Making one"): Set Up Refinement opened on what it
// picks first (session-setup.ts), Start Session handing the set-up on. Its own chunk, fetched only when chosen.
import { useState } from 'react';
import type { SessionSetup } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { SessionSetupDialog } from './SessionSetupDialog';
import { defaultSessionSetup } from './session-setup';

export function SessionStartHost({
  plan,
  onStart,
  onClose,
}: {
  plan: PlanContextValue;
  onStart: (setup: SessionSetup) => void;
  onClose: () => void;
}) {
  // Worked out once, as the dialog opens: picks made in it are the person's from then on.
  const [initial] = useState(() =>
    defaultSessionSetup({
      items: plan.items.values(),
      types: plan.types,
      planStatuses: [...plan.statusNames.keys()],
      statusNames: plan.statusNames,
    }),
  );
  return (
    <SessionSetupDialog
      sessionKind="refinement"
      initial={initial}
      plan={plan}
      settings={false}
      onDone={onStart}
      onClose={onClose}
    />
  );
}
