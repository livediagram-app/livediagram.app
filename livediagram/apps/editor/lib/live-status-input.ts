import { isSelfDrawingShape, STATUS_URL_MAX, type Element } from '@livediagram/document';
import { parsePublicHttpsUrl } from '@liveworkspace/model-core/public-https-url';

// The Live Status dialog's check (docs/specs/009-elements/live-status.md "The Live Status dialog"): the same address
// rules the document's validation holds `statusUrl` to (parsePublicHttpsUrl), read as someone types, so the dialog's
// refusal and the server's agree.

export const STATUS_URL_INVALID =
  'Enter an https address, like https://status.example.com/api/v2/status.json';
export const STATUS_URL_PRIVATE =
  "Private and internal addresses can't be checked. Use the service's public address.";

export type StatusUrlInput =
  | { ok: true; url: string }
  | { ok: false; error: 'empty' }
  | { ok: false; error: 'invalid' | 'private'; message: string };

// A scheme typed before the address: letters, digits, `+`, `-` and `.` up to `://`. Read left to right, no regex.
function hasScheme(text: string): boolean {
  const at = text.indexOf('://');
  if (at <= 0) return false;
  for (let i = 0; i < at; i++) {
    const c = text.charCodeAt(i);
    const letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const other = (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46;
    if (!letter && !(i > 0 && other)) return false;
  }
  return true;
}

/** What the field holds, as the binding it would save or why not. An address without a scheme gets `https://`. */
export function readStatusUrlInput(raw: string): StatusUrlInput {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };
  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = parsePublicHttpsUrl(candidate, STATUS_URL_MAX);
  if (!parsed.ok) {
    return parsed.error === 'private'
      ? { ok: false, error: 'private', message: STATUS_URL_PRIVATE }
      : { ok: false, error: 'invalid', message: STATUS_URL_INVALID };
  }
  // One address is one source however it was typed: the room keys its checks by the stored string.
  const url = parsed.url.href;
  return url.length > STATUS_URL_MAX
    ? { ok: false, error: 'invalid', message: STATUS_URL_INVALID }
    : { ok: true, url };
}

/** Whether a shape takes a live status binding: a shape with room for the badge, not locked. */
export function canBindLiveStatus(el: Element): boolean {
  return el.type === 'shape' && !isSelfDrawingShape(el.shape) && el.locked !== true;
}
