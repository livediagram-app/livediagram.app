// How a presentation behaves (spec/31), set from the cog in the presenter HUD.
//
// Device-local, like the other tool settings (the eraser's brush, the laser's
// pen): it is how YOU want to drive a deck on THIS machine, not a property of
// the diagram. A colleague opening the same diagram gets their own. Never sent
// to the api.

import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

const KEY = 'livediagram:v2:presentation-config';

/** How one slide gives way to the next. */
export type SlideTransition = 'slide' | 'fade' | 'none';

export type PresentationConfig = {
  transition: SlideTransition;
  /** Advance when the presenter clicks empty space. */
  advanceOnClick: boolean;
  /** After the last slide, go back to the first instead of the end state. */
  loop: boolean;
  /** Show the position and slide name in the HUD. */
  showPosition: boolean;
};

export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  transition: 'slide',
  advanceOnClick: true,
  loop: false,
  showPosition: true,
};

export const SLIDE_TRANSITIONS: readonly { id: SlideTransition; label: string; hint: string }[] = [
  { id: 'slide', label: 'Slide', hint: 'The whole screen travels, left or right' },
  { id: 'fade', label: 'Fade', hint: 'One slide dissolves into the next' },
  { id: 'none', label: 'None', hint: 'Cut straight to the next slide' },
];

export function loadPresentationConfig(): PresentationConfig {
  const raw = readLocalStorageSafe(KEY);
  if (!raw) return DEFAULT_PRESENTATION_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<PresentationConfig>;
    return {
      transition: SLIDE_TRANSITIONS.some((t) => t.id === parsed.transition)
        ? (parsed.transition as SlideTransition)
        : DEFAULT_PRESENTATION_CONFIG.transition,
      advanceOnClick:
        typeof parsed.advanceOnClick === 'boolean'
          ? parsed.advanceOnClick
          : DEFAULT_PRESENTATION_CONFIG.advanceOnClick,
      loop: typeof parsed.loop === 'boolean' ? parsed.loop : DEFAULT_PRESENTATION_CONFIG.loop,
      showPosition:
        typeof parsed.showPosition === 'boolean'
          ? parsed.showPosition
          : DEFAULT_PRESENTATION_CONFIG.showPosition,
    };
  } catch {
    // A corrupt blob costs the settings, never the presentation.
    return DEFAULT_PRESENTATION_CONFIG;
  }
}

export function savePresentationConfig(config: PresentationConfig): void {
  writeLocalStorageSafe(KEY, JSON.stringify(config));
}
