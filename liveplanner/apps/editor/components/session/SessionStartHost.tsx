'use client';

// Start Planning's sessions (docs/specs/026-plan/session-tabs.md "Making one", "Sprint Planning"): the kind's set-up
// opened on what it picks first (session-setup.ts), Start Session handing the set-up on. Its own chunk, fetched only
// when chosen.
import { useState } from 'react';
import type { SessionKindId } from '@liveplanner/items';
import type { SessionSetup } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { SessionSetupDialog } from './SessionSetupDialog';
import { defaultSessionSetup } from './session-setup';

export function SessionStartHost({
  sessionKind,
  plan,
  onStart,
  onClose,
}: {
  sessionKind: SessionKindId;
  plan: PlanContextValue;
  onStart: (setup: SessionSetup) => void;
  onClose: () => void;
}) {
  // Worked out once, as the dialog opens: picks made in it are the person's from then on.
  const [initial] = useState(() =>
    defaultSessionSetup({
      sessionKind,
      items: plan.items.values(),
      types: plan.types,
      planStatuses: [...plan.statusNames.keys()],
      statusNames: plan.statusNames,
    }),
  );
  return (
    <SessionSetupDialog
      sessionKind={sessionKind}
      initial={initial}
      plan={plan}
      settings={false}
      onDone={onStart}
      onClose={onClose}
    />
  );
}
