// The card door's answer (liveworkspace/docs/specs/006-media/previews.md "GET /api/previews/share/:code/card"), read by
// the share page's head (./share-page.ts) and by a pasted link's oEmbed (./oembed.ts): the item's name for a link
// whose preview may name it. The door's 404 covers an unknown, revoked, expired, trashed or password-protected link.

import {
  PRODUCTION_PREVIEWS_ORIGIN,
  WORKSPACE_CLIENT_IP_HEADER,
} from '@liveworkspace/sites/workspace-proxy';
import { previewSharePath, type SharePreviewCard } from './previews';

// How long a caller waits on the service. The card is an index read and a stored object's metadata (tens of
// milliseconds), so this only bites when something is in trouble.
export const SHARE_CARD_TIMEOUT_MS = 1500;

export type ShareCardOptions = {
  /** Where the previews service answers; unset means production's (liveworkspace.app). */
  previewsOrigin?: string;
  fetch?: typeof fetch;
};

/** `denied`: the door's 404, or an answer with no name; `unavailable`: the service failed or could not be reached. */
export type ShareCardAnswer = SharePreviewCard | 'denied' | 'unavailable';

/** Asks the card door for `code`, passing the visitor's address on, for `label`'s log lines. */
export async function fetchShareCard(
  request: Request,
  code: string,
  options: ShareCardOptions,
  label: string,
): Promise<ShareCardAnswer> {
  const origin = options.previewsOrigin || PRODUCTION_PREVIEWS_ORIGIN;
  const headers = new Headers();
  // The visitor's address, as the routers pass it on, so the service sees visitors rather than this Worker.
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set(WORKSPACE_CLIENT_IP_HEADER, ip);
  try {
    const res = await (options.fetch ?? fetch)(`${origin}${previewSharePath(code, 'card')}`, {
      headers,
      signal: AbortSignal.timeout(SHARE_CARD_TIMEOUT_MS),
    });
    if (res.status === 404) return 'denied';
    if (!res.ok) {
      console.warn(`[${label}] previews answered`, res.status);
      return 'unavailable';
    }
    const body = (await res.json()) as Partial<SharePreviewCard>;
    return typeof body.name === 'string' ? { name: body.name } : 'denied';
  } catch (err) {
    console.warn(`[${label}] previews unreachable`, String(err));
    return 'unavailable';
  }
}
