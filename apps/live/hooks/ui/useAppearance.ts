'use client';

import { APPEARANCE_LABEL, useAppearance as useSharedAppearance } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

// The editor's Appearance hook: the shared one (docs/specs/004-interface-design/appearance.md)
// plus a log and the editor's `UI / Toggled / <setting>` event on every explicit pick. The
// label is a closed preset, never user content (docs/specs/017-telemetry/telemetry.md).
export function useAppearance() {
  return useSharedAppearance((next) => {
    debugLog('[appearance] set', next);
    track('UI', 'Toggled', APPEARANCE_LABEL[next]);
  });
}
