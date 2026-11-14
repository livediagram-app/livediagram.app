import type { RoomNameResponse } from '@livehuddle/api-schema';
import { API_BASE, apiFetch, apiHeaders } from './core';

// Tell the canvas's room we renamed ourselves (docs/specs/014-identity/auth-and-guest-access.md "Presence names"). The
// api reads our profile fresh and the room shows that name to everyone: the request names nothing. The name the room
// now shows, or null when it has none for us (no profile, a link visitor) or the call failed.
export async function apiAnnounceRoomName(
  ownerId: string,
  documentId: string,
  shareCode: string | null = null,
): Promise<string | null> {
  try {
    const res = await apiFetch(
      `${API_BASE}/documents/${encodeURIComponent(documentId)}/room-name`,
      { method: 'POST', headers: await apiHeaders(ownerId, { share: shareCode }) },
    );
    if (!res.ok) return null;
    const { name } = (await res.json()) as Partial<RoomNameResponse>;
    return typeof name === 'string' && name ? name : null;
  } catch {
    return null;
  }
}
