import { truthFrom, type Truth } from '@livediagram/sticky-vision';

// EXPORTING GROUND TRUTH from the review surface (docs/vision/sticky-detection.md).
//
// The detector is tuned by hand against labelled photographs, and labelling a
// wall by drawing fifty boxes from scratch is work nobody finishes. The review
// surface already asks the author to do exactly that work for real: untick
// what is not a note, drag a box around what was missed. What is on screen
// when they are done IS a labelling, and this hands it back as a file.
//
// It is a CALIBRATION affordance, not a feature, so WHERE the editor is being
// served decides whether it shows: calibration happens on a developer's own
// machine, against photographs on that machine's disk, so localhost has it and
// the hosted site never does. A flag overrules the host either way, for a
// self-host that wants it off on localhost or a developer labelling against a
// deployed build.
//
// The flag alone was not enough, and failing it taught the lesson: `?truth=1`
// is typed on /new, and the editor is three navigations later at
// /diagram/<id>, so any reload of the page you are actually looking at loses
// it. A rule that depends on remembering to re-type a parameter is a rule that
// is off when you need it.

export const TRUTH_ARMED_KEY = 'livediagram:truth';

// Served from this machine or its own network: a development build, where the
// photographs and the sweep are. By ANY name the machine answers to: reached
// from a second device it is its LAN address or its bare machine name, never
// "localhost".
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

// RFC 1918 private ranges: never where the hosted site lives.
function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isLocalHost(hostname: string): boolean {
  if (LOCAL_HOSTS.has(hostname) || isPrivateIpv4(hostname)) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) return true;
  // A bare machine name ("PCWebber"): no public site is reachable without a dot.
  return hostname !== '' && !hostname.includes('.') && !hostname.includes(':');
}

// A browser can refuse storage entirely (private mode, a locked-down profile).
// Not being able to label is not a reason to take the editor down.
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// The rule itself, free of the browser: the flag wins where it is set, and
// otherwise the host decides.
export function truthArmedOn(hostname: string, flag: string | null): boolean {
  if (flag === '1') return true;
  if (flag === '0') return false;
  return isLocalHost(hostname);
}

export function truthArmed(): boolean {
  try {
    return truthArmedOn(
      globalThis.location?.hostname ?? '',
      storage()?.getItem(TRUTH_ARMED_KEY) ?? null,
    );
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
    // Both directions are remembered, because on localhost the flag's job is
    // usually to turn the thing OFF.
    if (value === '1') storage()?.setItem(TRUTH_ARMED_KEY, '1');
    else if (value === '0') storage()?.setItem(TRUTH_ARMED_KEY, '0');
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
  boxes: readonly { x: number; y: number; w: number; h: number; kind: string; text?: string }[],
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
