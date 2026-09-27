'use client';

import { APPEARANCE_LABEL, useAppearance as useSharedAppearance } from '@livediagram/ui';
import { track } from '@/lib/telemetry';

// The editor's Appearance hook: the shared one (docs/specs/004-interface-design/appearance.md)
// plus the editor's `UI / Toggled / <setting>` event on every explicit pick. The label
// is a closed preset, never user content (docs/specs/017-telemetry/telemetry.md).
export function useAppearance() {
  return useSharedAppearance((next) => track('UI', 'Toggled', APPEARANCE_LABEL[next]));
}
