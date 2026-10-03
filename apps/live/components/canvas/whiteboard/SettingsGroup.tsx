'use client';

// The dock's Settings group (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"): the
// cog on its own, last; the Palette panel's footer row in the Floating layout. It opens the Settings flyout on a press only, never on hover.

import { DockButton, DockToolbar } from './DockToolbar';
import type { DockFlyoutApi } from './useDockFlyout';
import { SettingsGlyph } from './whiteboard-icons';

export function SettingsGroup({ fly }: { fly: DockFlyoutApi }) {
  return (
    <DockToolbar label="Settings" group="settings" footer>
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
