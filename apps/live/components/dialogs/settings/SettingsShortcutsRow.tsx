'use client';

import { SettingsRow } from './SettingsRow';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import type { SettingsShortcutsRowSpec } from './settings-catalogue';

// The keyboard-shortcuts master switch. Like appearance, it is backed by its
// own per-device localStorage store rather than UserPreferences (docs/specs/007-editor/live-app.md),
// so it reads and writes here instead of through the catalogue. The hook
// emits its own telemetry on set, which is why nothing is tracked here.
//
// It heads the Keyboard category, above the list of every binding it gates.
export function SettingsShortcutsRow({ row }: { row: SettingsShortcutsRowSpec }) {
  const { enabled, setEnabled } = useShortcutsEnabled();
  return <SettingsRow row={row} checked={enabled} onChange={setEnabled} />;
}
