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
export type SlideSpeed = 'quick' | 'normal' | 'slow';
/** How big a slide is allowed to be drawn. */
export type SlideZoom = 'fill' | 'actual';

export type PresentationConfig = {
  transition: SlideTransition;
  speed: SlideSpeed;
  /** Advance when the presenter clicks empty space. */
  advanceOnClick: boolean;
  /** Seconds between automatic advances; 0 = off. */
  autoAdvanceSeconds: number;
  /** After the last slide, go back to the first instead of the end state. */
  loop: boolean;
  /** 'fill' lets a small slide zoom past 100%; 'actual' caps it there. */
  zoom: SlideZoom;
  /** Show the position and slide name in the HUD. */
  showPosition: boolean;
  /** Keep the HUD on screen instead of fading it when the pointer rests. */
  keepControls: boolean;
  /** Hide the mouse pointer while it is still. */
  hidePointer: boolean;
};

export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  transition: 'slide',
  speed: 'normal',
  advanceOnClick: true,
  autoAdvanceSeconds: 0,
  loop: false,
  zoom: 'fill',
  showPosition: true,
  keepControls: false,
  hidePointer: true,
};

export const SLIDE_TRANSITIONS: readonly { id: SlideTransition; label: string; hint: string }[] = [
  { id: 'slide', label: 'Slide', hint: 'The whole screen travels, left or right' },
  { id: 'fade', label: 'Fade', hint: 'One slide dissolves into the next' },
  { id: 'none', label: 'None', hint: 'Cut straight to the next slide' },
];

export const SLIDE_SPEEDS: readonly { id: SlideSpeed; label: string; ms: number }[] = [
  { id: 'quick', label: 'Quick', ms: 220 },
  { id: 'normal', label: 'Normal', ms: 380 },
  { id: 'slow', label: 'Slow', ms: 620 },
];

export const SLIDE_ZOOMS: readonly { id: SlideZoom; label: string; hint: string }[] = [
  { id: 'fill', label: 'Fill screen', hint: 'A small slide is blown up to fill the screen' },
  { id: 'actual', label: 'Actual size', hint: 'Never zoom past 100%, however small the slide' },
];

// Off, then the intervals an unattended deck in a room actually wants. Paired
// with Loop, this is the "leave it running on the wall" setup.
export const AUTO_ADVANCE_CHOICES: readonly { seconds: number; label: string }[] = [
  { seconds: 0, label: 'Off' },
  { seconds: 5, label: '5s' },
  { seconds: 10, label: '10s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '60s' },
];

/** The transition duration in ms for the chosen speed. */
export function slideDurationMs(config: PresentationConfig): number {
  return SLIDE_SPEEDS.find((s) => s.id === config.speed)?.ms ?? 380;
}

/** The zoom ceiling a slide may be fitted to. */
export function slideMaxZoom(config: PresentationConfig): number {
  // 2.5 is a slide filling a projector; 1 is the editor's own "never enlarge"
  // rule, for authors whose slides are already the size they meant.
  return config.zoom === 'actual' ? 1 : 2.5;
}

export function loadPresentationConfig(): PresentationConfig {
  const raw = readLocalStorageSafe(KEY);
  if (!raw) return DEFAULT_PRESENTATION_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<PresentationConfig>;
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    return {
      transition: SLIDE_TRANSITIONS.some((t) => t.id === parsed.transition)
        ? (parsed.transition as SlideTransition)
        : DEFAULT_PRESENTATION_CONFIG.transition,
      speed: SLIDE_SPEEDS.some((t) => t.id === parsed.speed)
        ? (parsed.speed as SlideSpeed)
        : DEFAULT_PRESENTATION_CONFIG.speed,
      zoom: SLIDE_ZOOMS.some((t) => t.id === parsed.zoom)
        ? (parsed.zoom as SlideZoom)
        : DEFAULT_PRESENTATION_CONFIG.zoom,
      autoAdvanceSeconds: AUTO_ADVANCE_CHOICES.some((c) => c.seconds === parsed.autoAdvanceSeconds)
        ? (parsed.autoAdvanceSeconds as number)
        : DEFAULT_PRESENTATION_CONFIG.autoAdvanceSeconds,
      advanceOnClick: bool(parsed.advanceOnClick, DEFAULT_PRESENTATION_CONFIG.advanceOnClick),
      loop: bool(parsed.loop, DEFAULT_PRESENTATION_CONFIG.loop),
      showPosition: bool(parsed.showPosition, DEFAULT_PRESENTATION_CONFIG.showPosition),
      keepControls: bool(parsed.keepControls, DEFAULT_PRESENTATION_CONFIG.keepControls),
      hidePointer: bool(parsed.hidePointer, DEFAULT_PRESENTATION_CONFIG.hidePointer),
    };
  } catch {
    // A corrupt blob costs the settings, never the presentation.
    return DEFAULT_PRESENTATION_CONFIG;
  }
}

export function savePresentationConfig(config: PresentationConfig): void {
  writeLocalStorageSafe(KEY, JSON.stringify(config));
}
