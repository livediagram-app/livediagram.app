// The Spotlight's look (spec/112), persisted per browser — the laser pen's
// hook with a different config type, for the same reason: a presenter sets
// this up once for their screen and expects it next time.
//
// The RADIUS is not here: it lives on useSpotlight as session state, because
// clicking the canvas changes it constantly and restoring last month's value
// would be a surprise rather than a convenience.

import { useState } from 'react';
import {
  loadSpotlightConfig,
  saveSpotlightConfig,
  type SpotlightConfig,
} from '@/lib/spotlight-config';
import { track } from '@/lib/telemetry';

const TELEMETRY_TYPE: Record<keyof SpotlightConfig, string> = {
  size: 'SpotlightSize',
  dim: 'SpotlightDim',
  edge: 'SpotlightEdge',
  shape: 'SpotlightShape',
};

export function useSpotlightConfig() {
  const [config, setConfigState] = useState<SpotlightConfig>(() => loadSpotlightConfig());

  const setField = <K extends keyof SpotlightConfig>(field: K, value: SpotlightConfig[K]) => {
    if (config[field] === value) return;
    const next = { ...config, [field]: value };
    setConfigState(next);
    saveSpotlightConfig(next);
    track('UI', 'Changed', TELEMETRY_TYPE[field]);
  };

  return { config, setField };
}
