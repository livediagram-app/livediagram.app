// A live embed's ticket (liveworkspace/docs/specs/011-workbench/workbench.md "Live embed tickets"): asked of this page's
// own address with the reader's own token, for the item's app, bound to this page's origin. The answer in the words the
// face needs: a ticket and the frame's path, or why there is none.
import type { LiveItem } from '@liveworkspace/element-model/live-item';
import { workbench } from '../../bindings';

export const LIVE_EMBED_TICKET_PATH = '/api/workbench/embed-tickets';

export type LiveEmbedTicket =
  | { ok: true; ticket: string; path: string; expiresAt: number }
  // The reader cannot open it (no access, or no one to ask as), it is in the Trash or gone, or no answer now.
  | { ok: false; reason: 'no-access' | 'gone' | 'failed' };

export async function requestLiveEmbedTicket(
  item: LiveItem,
  origin: string = window.location.origin,
): Promise<LiveEmbedTicket> {
  const bearer = await workbench.api.currentBearer();
  if (!bearer) return { ok: false, reason: 'no-access' };
  let res: Response;
  try {
    res = await fetch(new URL(LIVE_EMBED_TICKET_PATH, origin), {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: item.app, itemId: item.itemId, origin }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (res.status === 404 || res.status === 401 || res.status === 403)
    return { ok: false, reason: 'no-access' };
  if (res.status === 410) return { ok: false, reason: 'gone' };
  if (!res.ok) return { ok: false, reason: 'failed' };
  try {
    const body = (await res.json()) as { ticket?: unknown; path?: unknown; expiresAt?: unknown };
    if (
      typeof body.ticket !== 'string' ||
      typeof body.path !== 'string' ||
      !body.path.startsWith('/embed/workbench?') ||
      typeof body.expiresAt !== 'number'
    )
      return { ok: false, reason: 'failed' };
    return { ok: true, ticket: body.ticket, path: body.path, expiresAt: body.expiresAt };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
