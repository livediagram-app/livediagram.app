'use client';

// The browser's EyeDropper (docs/specs/008-canvas/canvas-and-palette.md Colours): click the pipette, then click
// anywhere on the screen, and the colour under the pointer comes back as a
// hex. It samples the whole screen, not just the canvas, so a colour can be
// lifted from an image, a logo in another window, or an element already on
// the board. Chromium ships it; where it is missing the hook says so and the
// pipette is simply not offered, since there is no fallback worth the
// button.

import { useCallback, useMemo } from 'react';

type EyeDropperResult = { sRGBHex: string };
type EyeDropperCtor = new () => {
  open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
};

declare global {
  interface Window {
    EyeDropper?: EyeDropperCtor;
  }
}

export function useEyeDropper(): {
  supported: boolean;
  /** Resolves to a `#rrggbb`, or null when the pick was cancelled (Escape). */
  pick: () => Promise<string | null>;
} {
  const supported = useMemo(
    () => typeof window !== 'undefined' && typeof window.EyeDropper === 'function',
    [],
  );
  const pick = useCallback(async () => {
    const Ctor = typeof window !== 'undefined' ? window.EyeDropper : undefined;
    if (!Ctor) return null;
    try {
      const { sRGBHex } = await new Ctor().open();
      return sRGBHex.toLowerCase();
    } catch {
      // The browser rejects on Escape / focus loss. Not an error: nothing
      // was picked.
      return null;
    }
  }, []);
  return { supported, pick };
}
