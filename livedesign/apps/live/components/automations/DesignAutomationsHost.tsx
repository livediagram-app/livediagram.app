'use client';

// Gives the editor its Automations and draws the screen while it is open (docs/specs/013-workspace/automations.md
// "Where it is"; blueprint automations.md "Editor", "The door"): the platform's host with livedesign's plumbing, its
// screen and its gate, and the open design the screen reads (DesignItemContext). The screen's code (the
// platform's dialog with the design's kit) and the gate's load the first time each opens
// (docs/specs/016-platform/web-performance.md), so a design whose Editor never opens them pays nothing for them;
// design-automations-lazy.test.ts keeps this file, the footer's row and the plumbing free of both.

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AutomationsHost } from '@liveworkspace/automations-ui';
import { DesignItemContext } from './design-item';
import { DESIGN_AUTOMATIONS_PLUMBING } from './design-plumbing';
import type { DesignAutomations } from './use-design-automations';

const DesignAutomationsScreen = dynamic(
  () => import('./DesignAutomationsScreen').then((m) => m.DesignAutomationsScreen),
  { ssr: false },
);
const DesignAutomationsGate = dynamic(
  () => import('./DesignAutomationsGate').then((m) => m.DesignAutomationsGate),
  { ssr: false },
);

export function DesignAutomationsHost({
  scope,
  gate,
  signedIn,
  item,
  children,
}: DesignAutomations & { children: ReactNode }) {
  return (
    <DesignItemContext value={item}>
      <AutomationsHost
        plumbing={DESIGN_AUTOMATIONS_PLUMBING}
        scope={scope}
        gate={gate}
        signedIn={signedIn}
        Screen={DesignAutomationsScreen}
        Gate={DesignAutomationsGate}
      >
        {children}
      </AutomationsHost>
    </DesignItemContext>
  );
}
