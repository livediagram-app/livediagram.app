'use client';

// The Automations screen as livedesign draws it (docs/specs/013-workspace/automations.md "The screen"): the
// platform's dialog with the design's kit. Loaded with its own chunk the first time the screen opens
// (DesignAutomationsHost).

import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import type { AutomationsScreenProps } from '@liveworkspace/automations-ui/AutomationsHost';
import { AutomationsKitProvider } from '@liveworkspace/automations-ui/kit-context';
import { DESIGN_AUTOMATIONS_KIT } from './design-kit';

export function DesignAutomationsScreen(props: AutomationsScreenProps) {
  return (
    <AutomationsKitProvider kit={DESIGN_AUTOMATIONS_KIT}>
      <AutomationsDialog {...props} />
    </AutomationsKitProvider>
  );
}
