'use client';

// The dock's Settings group (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): the
// cog on its own, last. It opens the Settings flyout on a press only, never on hover.

import { DockButton, DockToolbar } from './DockToolbar';
import type { DockFlyoutApi } from './useDockFlyout';
import { SettingsGlyph } from './whiteboard-icons';

export function SettingsGroup({ fly }: { fly: DockFlyoutApi }) {
  return (
    <DockToolbar label="Settings" group="settings">
      <DockButton
        itemKey="settings"
        label="Settings"
        icon={<SettingsGlyph />}
        controls={{ id: 'whiteboard-flyout-settings', expanded: fly.flyout?.kind === 'settings' }}
        onPress={(el) => fly.toggle('settings', el)}
      />
    </DockToolbar>
  );
}
