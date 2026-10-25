'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/account-api';

// What the settings page tells the person when a write is refused; anything else reads as the
// account pages' own messages.
const MESSAGES: Record<string, string> = {
  invalid_name: 'That name can’t be used. Use up to 120 letters, numbers and punctuation.',
  invalid_color: 'That colour can’t be used. Pick one of the swatches.',
  settings_too_large: 'Your settings are full. Reset some in an app, then try again.',
  unknown_owner: 'Your account couldn’t be found. Sign in again to carry on.',
};

export function settingsErrorMessage(error: string): string {
  return MESSAGES[error] ?? errorMessage(error);
}

// How long "Saved" shows after a write lands.
const SAVED_MS = 2_000;

// A "Saved" note that shows for a moment after each successful write, and clears its timer when the
// page moves on.
export function useSavedFlash(): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaved(true);
    timer.current = setTimeout(() => setSaved(false), SAVED_MS);
  }, []);
  return [saved, flash];
}
