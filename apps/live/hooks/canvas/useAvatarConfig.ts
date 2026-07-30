// The Avatar-mode character's customisation state (spec/101): gender,
// clothing, hair, and size, loaded from and written back to per-browser
// storage so the character you built is the one waiting next time you enter
// the mode.
//
// Separate from useAvatarWalk (which owns position / animation) because this is
// the slice the Avatar Panel edits and the sprite reads — it outlives any one
// walk, and it is the only avatar state that persists at all.

import { useEffect, useState } from 'react';
import {
  hasStoredAvatarConfig,
  loadAvatarConfig,
  randomAvatarConfig,
  saveAvatarConfig,
  type AvatarConfig,
} from '@/lib/avatar-config';
import { track } from '@/lib/telemetry';

export function useAvatarConfig({ active }: { active: boolean }) {
  // Lazy initial read: localStorage is unavailable during the static-export
  // render, and loadAvatarConfig's safe wrapper falls back there, so the first
  // client paint matches the server's. On a browser that has never used the
  // mode this rolls a RANDOM character rather than handing everyone the same
  // default one.
  const [config, setConfigState] = useState<AvatarConfig>(() => loadAvatarConfig());

  // Pin that first roll, the first time the mode is actually ENTERED. Without
  // pinning, "random on first use" would be random on every use — the character
  // is meant to become yours. Gated on `active` so a user who never opens Avatar
  // mode never has a character written for them, and done in an effect (not the
  // state initialiser) so the write happens once, after commit, rather than
  // during a render React may discard.
  useEffect(() => {
    if (!active) return;
    if (!hasStoredAvatarConfig()) saveAvatarConfig(config);
    // Only the entry edge matters; later changes persist through setConfig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

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

  // Reset rolls a NEW random character rather than returning the plain default
  // one — "reset" here means "give me a different one", the same thing the
  // first-use roll does.
  const reset = () => setConfig(randomAvatarConfig());

  return { config, setField, toggleGender, reset };
}
