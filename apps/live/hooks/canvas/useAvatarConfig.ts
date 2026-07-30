// The Avatar-mode character's customisation state (spec/101): gender,
// clothing, hair, and size, loaded from and written back to per-browser
// storage so the character you built is the one waiting next time you enter
// the mode.
//
// Separate from useAvatarWalk (which owns position / animation) because this is
// the slice the Avatar Panel edits and the sprite reads — it outlives any one
// walk, and it is the only avatar state that persists at all.

import { useState } from 'react';
import {
  DEFAULT_AVATAR_CONFIG,
  loadAvatarConfig,
  saveAvatarConfig,
  type AvatarConfig,
} from '@/lib/avatar-config';
import { track } from '@/lib/telemetry';

export function useAvatarConfig() {
  // Lazy initial read: localStorage is unavailable during the static-export
  // render, and loadAvatarConfig's safe wrapper returns the defaults there, so
  // the first client paint matches the server's.
  const [config, setConfigState] = useState<AvatarConfig>(() => loadAvatarConfig());

  // Persist on every change (the panel edits one field at a time), and tell
  // telemetry WHICH kind of choice was made — never the value's meaning beyond
  // the preset token, per spec/22.
  const setConfig = (next: AvatarConfig, changed?: keyof AvatarConfig) => {
    setConfigState(next);
    saveAvatarConfig(next);
    if (changed) {
      track(
        'UI',
        'Changed',
        changed === 'gender'
          ? 'AvatarGender'
          : changed === 'clothing'
            ? 'AvatarClothing'
            : changed === 'hair'
              ? 'AvatarHair'
              : 'AvatarSize',
      );
    }
  };

  // Field-level setter the panel's option rows call.
  const setField = <K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) => {
    if (config[field] === value) return;
    setConfig({ ...config, [field]: value }, field);
  };

  // Right-clicking the character on the canvas flips the gender (spec/101) —
  // the one customisation reachable without opening the panel.
  const toggleGender = () => {
    setField('gender', config.gender === 'male' ? 'female' : 'male');
  };

  const reset = () => setConfig({ ...DEFAULT_AVATAR_CONFIG });

  return { config, setField, toggleGender, reset };
}
