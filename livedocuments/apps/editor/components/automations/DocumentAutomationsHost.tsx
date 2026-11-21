'use client';

// Gives the editor its Automations and draws the screen while it is open (docs/specs/013-workspace/automations.md
// "Where it is"; blueprint automations.md "Editor", "The door"): the platform's host with livedocuments' plumbing, its
// screen and its gate, and the open document the screen reads (DocumentItemContext). The screen's code (the
// platform's dialog with the document's kit) and the gate's load the first time each opens
// (docs/specs/016-platform/web-performance.md), so a document whose Editor never opens them pays nothing for them;
// document-automations-lazy.test.ts keeps this file, the footer's row and the plumbing free of both.

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AutomationsHost } from '@liveworkspace/automations-ui';
import { DocumentItemContext } from './document-item';
import { DOCUMENT_AUTOMATIONS_PLUMBING } from './document-plumbing';
import type { DocumentAutomations } from './use-document-automations';

const DocumentAutomationsScreen = dynamic(
  () => import('./DocumentAutomationsScreen').then((m) => m.DocumentAutomationsScreen),
  { ssr: false },
);
const DocumentAutomationsGate = dynamic(
  () => import('./DocumentAutomationsGate').then((m) => m.DocumentAutomationsGate),
  { ssr: false },
);

export function DocumentAutomationsHost({
  scope,
  gate,
  signedIn,
  item,
  children,
}: DocumentAutomations & { children: ReactNode }) {
  return (
    <DocumentItemContext value={item}>
      <AutomationsHost
        plumbing={DOCUMENT_AUTOMATIONS_PLUMBING}
        scope={scope}
        gate={gate}
        signedIn={signedIn}
        Screen={DocumentAutomationsScreen}
        Gate={DocumentAutomationsGate}
      >
        {children}
      </AutomationsHost>
    </DocumentItemContext>
  );
}
