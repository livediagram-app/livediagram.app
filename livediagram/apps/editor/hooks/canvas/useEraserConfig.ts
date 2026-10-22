// The eraser's settings (docs/specs/008-canvas/eraser-panel.md), persisted per browser — the laser and
// spotlight hooks with a different config type.

import { useState } from 'react';
import { loadEraserConfig, saveEraserConfig, type EraserConfig } from '@/lib/eraser-config';
import { track } from '@/lib/telemetry';

const TELEMETRY_TYPE: Record<keyof EraserConfig, string> = {
  mode: 'EraserMode',
  size: 'EraserSize',
  target: 'EraserTarget',
};

export function useEraserConfig() {
  const [config, setConfigState] = useState<EraserConfig>(() => loadEraserConfig());

  const setField = <K extends keyof EraserConfig>(field: K, value: EraserConfig[K]) => {
    if (config[field] === value) return;
    const next = { ...config, [field]: value };
    setConfigState(next);
    saveEraserConfig(next);
    track('UI', 'Changed', TELEMETRY_TYPE[field]);
  };

  return { config, setField };
}
