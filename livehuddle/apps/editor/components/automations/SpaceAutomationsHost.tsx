'use client';

// Gives the editor its Automations and draws the screen while it is open (docs/specs/013-workspace/automations.md
// "Where it is"; blueprint automations.md "Editor", "The door"): the platform's host with livehuddle's plumbing, its
// screen and its gate, and the open Space the screen reads (SpaceItemContext). The screen's code (the platform's
// dialog with the Space's kit) and the gate's load the first time each opens (docs/specs/016-platform/
// web-performance.md), so a Space whose Editor never opens them pays nothing for them; space-automations-lazy.test.ts
// keeps this file, the footer's row and the plumbing free of both.

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AutomationsHost } from '@liveworkspace/automations-ui';
import { SpaceItemContext } from './space-item';
import { SPACE_AUTOMATIONS_PLUMBING } from './space-plumbing';
import type { SpaceAutomations } from './use-space-automations';

const SpaceAutomationsScreen = dynamic(
  () => import('./SpaceAutomationsScreen').then((m) => m.SpaceAutomationsScreen),
  { ssr: false },
);
const SpaceAutomationsGate = dynamic(
  () => import('./SpaceAutomationsGate').then((m) => m.SpaceAutomationsGate),
  { ssr: false },
);

export function SpaceAutomationsHost({
  scope,
  gate,
  signedIn,
  item,
  children,
}: SpaceAutomations & { children: ReactNode }) {
  return (
    <SpaceItemContext value={item}>
      <AutomationsHost
        plumbing={SPACE_AUTOMATIONS_PLUMBING}
        scope={scope}
        gate={gate}
        signedIn={signedIn}
        Screen={SpaceAutomationsScreen}
        Gate={SpaceAutomationsGate}
      >
        {children}
      </AutomationsHost>
    </SpaceItemContext>
  );
}
