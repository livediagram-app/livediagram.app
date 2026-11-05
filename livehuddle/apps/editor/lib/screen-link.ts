import { screenVideoTarget, SCREEN_URL_MAX } from '@livehuddle/document';

// A Screen's Video Link as typed (docs/specs/009-elements/screen-and-room-sign.md "Screen"), shared by the element
// menu and the walking reader so both judge a link the same way.

/** A bare youtu.be/... is judged as the https:// address that would be stored, as the video element's picker does. */
export function normalisedScreenLink(raw: string): string {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
}

/** Whether a normalised link may be stored: short enough and a video the Screen can play. */
export function isScreenLink(url: string): boolean {
  return url.length > 0 && url.length <= SCREEN_URL_MAX && screenVideoTarget(url) !== null;
}
