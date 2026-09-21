import { truthFrom, type Truth } from '@livediagram/sticky-vision';

// EXPORTING GROUND TRUTH from the review surface (docs/vision/sticky-detection.md).
//
// The detector is tuned by hand against labelled photographs, and labelling a
// wall by drawing fifty boxes from scratch is work nobody finishes. The review
// surface already asks the author to do exactly that work for real: untick
// what is not a note, drag a box around what was missed. What is on screen
// when they are done IS a labelling, and this hands it back as a file.
//
// It is a CALIBRATION affordance, not a feature. Nobody importing a photo of
// their own wall should ever meet it, so it stays off until someone arms it by
// hand — `?truth=1` on any editor URL, remembered from then on, because the
// editor is reached from /new and a parameter does not survive that hop.

export const TRUTH_ARMED_KEY = 'livediagram:truth';

// A browser can refuse storage entirely (private mode, a locked-down profile).
// Not being able to label is not a reason to take the editor down.
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function truthArmed(): boolean {
  try {
    return storage()?.getItem(TRUTH_ARMED_KEY) === '1';
  } catch {
    return false;
  }
}

// `?truth=1` arms it, `?truth=0` disarms it, anything else leaves it alone.
export function armTruthFromUrl(href: string): void {
  let value: string | null;
  try {
    value = new URL(href).searchParams.get('truth');
  } catch {
    // Not a URL we can read; there is nothing to arm from.
    return;
  }
  if (value === null) return;
  try {
    if (value === '1') storage()?.setItem(TRUTH_ARMED_KEY, '1');
    else storage()?.removeItem(TRUTH_ARMED_KEY);
  } catch {
    /* a browser that refuses storage cannot be armed, and that is fine */
  }
}

// The corrected review, as a label file the sweep can score against. The boxes
// arrive in WORKING-image pixels, which is what the review works in.
export function truthOf(
  fileName: string,
  size: { width: number; height: number },
  boxes: readonly { x: number; y: number; w: number; h: number; kind: string }[],
): Truth {
  return truthFrom(fileName, size, boxes);
}

// Hand it to the browser as a download. The labels describe somebody's real
// wall, so they go to the author's own disk and nowhere else — this never
// posts anything.
export function downloadTruth(truth: Truth): void {
  const blob = new Blob([JSON.stringify(truth, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${truth.photo}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
