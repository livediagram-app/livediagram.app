// The laser pen's settings (spec/111), loaded from and written back to
// per-browser storage so the pen you set up is the one waiting next time you
// present.
//
// Deliberately the same shape as useAvatarConfig: a persisted config object, a
// field-level setter for the panel's rows, and telemetry naming WHICH setting
// changed (never a value beyond its preset token, per spec/22).

import { useState } from 'react';
import { loadLaserConfig, saveLaserConfig, type LaserConfig } from '@/lib/laser-config';
import { track } from '@/lib/telemetry';

const TELEMETRY_TYPE: Record<keyof LaserConfig, string> = {
  width: 'LaserWidth',
  colour: 'LaserColour',
  trail: 'LaserTrail',
  effect: 'LaserEffect',
};

export function useLaserConfig() {
  // Lazy initial read: localStorage is unavailable during the static-export
  // render and the safe wrapper falls back there, so the first client paint
  // matches the server's. Unlike the avatar there is no random roll — a
  // surprise pen mid-presentation is the opposite of what this is for.
  const [config, setConfigState] = useState<LaserConfig>(() => loadLaserConfig());

  const setField = <K extends keyof LaserConfig>(field: K, value: LaserConfig[K]) => {
    if (config[field] === value) return;
    const next = { ...config, [field]: value };
    setConfigState(next);
    saveLaserConfig(next);
    track('UI', 'Changed', TELEMETRY_TYPE[field]);
  };

  return { config, setField };
}
