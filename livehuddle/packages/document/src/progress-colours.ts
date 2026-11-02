// A progress element's track and its percentage ink (docs/specs/009-elements/progress.md "The percentage stays
// legible"): one answer for the canvas's ProgressView and the headless emitter.
import { defaultFillColor, type CanvasSurface } from './colors';
import { readableInk } from './cell-colours';
import type { BoxedElement } from './index';

/** The track a progress element with no fill of its own draws on light paper (slate-200). */
export const PROGRESS_TRACK_DEFAULT = '#e2e8f0';

/** The empty part of the meter: the element's own fill, else a pale slate on light paper and the
 *  dark-ink shape fill on dark paper. */
export function progressTrackColour(el: BoxedElement, surface: CanvasSurface = 'light'): string {
  return (
    el.fillColor ?? (surface === 'dark' ? defaultFillColor(el, 'dark') : PROGRESS_TRACK_DEFAULT)
  );
}

export type ProgressLabelInks = {
  /** The percentage's ink over the filled portion. */
  onFill: string;
  /** The percentage's ink over the track. */
  onTrack: string;
};

/** The bar's percentage ink per part: `text` lifted or deepened to 4.5:1 against each. */
export function progressLabelInks(text: string, accent: string, track: string): ProgressLabelInks {
  return { onFill: readableInk(text, accent), onTrack: readableInk(text, track) };
}
