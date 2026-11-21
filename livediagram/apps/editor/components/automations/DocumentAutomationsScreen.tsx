'use client';

// The Automations screen as livediagram draws it (docs/specs/013-workspace/automations.md "The screen"): the
// platform's dialog with the document's kit. Loaded with its own chunk the first time the screen opens
// (DocumentAutomationsHost).

import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import type { AutomationsScreenProps } from '@liveworkspace/automations-ui/AutomationsHost';
import { AutomationsKitProvider } from '@liveworkspace/automations-ui/kit-context';
import { DOCUMENT_AUTOMATIONS_KIT } from './document-kit';

export function DocumentAutomationsScreen(props: AutomationsScreenProps) {
  return (
    <AutomationsKitProvider kit={DOCUMENT_AUTOMATIONS_KIT}>
      <AutomationsDialog {...props} />
    </AutomationsKitProvider>
  );
}
