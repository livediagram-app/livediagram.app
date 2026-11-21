'use client';

// The Automations screen as livehuddle draws it (docs/specs/013-workspace/automations.md "The screen"): the
// platform's dialog with the Space's kit. Loaded with its own chunk the first time the screen opens
// (SpaceAutomationsHost).

import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import type { AutomationsScreenProps } from '@liveworkspace/automations-ui/AutomationsHost';
import { AutomationsKitProvider } from '@liveworkspace/automations-ui/kit-context';
import { SPACE_AUTOMATIONS_KIT } from './space-kit';

export function SpaceAutomationsScreen(props: AutomationsScreenProps) {
  return (
    <AutomationsKitProvider kit={SPACE_AUTOMATIONS_KIT}>
      <AutomationsDialog {...props} />
    </AutomationsKitProvider>
  );
}
