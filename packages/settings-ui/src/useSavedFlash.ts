'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// How long "Saved" shows after a write lands.
const SAVED_MS = 2_000;

/** A "Saved" note that shows for a moment after each successful write, and clears its timer when the view goes. */
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
