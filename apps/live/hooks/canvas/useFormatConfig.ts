// The format painter's settings (spec/117), persisted per browser — the same
// shape as the other tool-panel hooks.

import { useState } from 'react';
import {
  loadFormatConfig,
  saveFormatConfig,
  type FormatConfig,
  type FormatGroup,
  type FormatMode,
} from '@/lib/format-config';
import { track } from '@/lib/telemetry';

export function useFormatConfig() {
  const [config, setConfigState] = useState<FormatConfig>(() => loadFormatConfig());

  const write = (next: FormatConfig, type: string) => {
    setConfigState(next);
    saveFormatConfig(next);
    track('UI', 'Changed', type);
  };

  // One toggle at a time. The telemetry names WHICH setting moved, never the
  // resulting set (spec/22).
  const toggleGroup = (group: FormatGroup) => {
    write(
      { ...config, copies: { ...config.copies, [group]: !config.copies[group] } },
      'FormatCopies',
    );
  };

  const setMode = (mode: FormatMode) => {
    if (config.mode === mode) return;
    write({ ...config, mode }, 'FormatMode');
  };

  return { config, toggleGroup, setMode };
}
