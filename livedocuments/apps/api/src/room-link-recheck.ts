// The join-time look at a share link (docs/specs/013-workspace/tab-scoped-share-links.md "Rescoping").
//
// A share session's scope and code come from its ticket, minted over REST a moment before the upgrade.
// A revoke or rescope that lands between that mint and the room accepting the socket broadcasts to a
// room this session is not in yet, so it would join on the old link and never hear of the change.
// Once the socket is accepted the room reads the link again: a change seen here is told to this one
// session; a change not seen yet has not been written, so its broadcast reaches the socket.

import type { Env } from './types';
import { shareLinkForDocument } from './auth/share-access';

type AdmittedLink = { shareCode: string; tabScope: string | null; documentId: string };
type ShareLinkChange = 'share-revoked' | 'share-rescoped';

// What changed about the link since the ticket admitted the session: gone (revoked, expired, or its
// tab deleted) or scoped to another tab. Null when it still opens what the session holds.
export function shareLinkChange(
  admitted: AdmittedLink,
  link: { tabId: string | null } | null,
): ShareLinkChange | null {
  if (!link) return 'share-revoked';
  return (link.tabId ?? null) === admitted.tabScope ? null : 'share-rescoped';
}

// The op this session should have received, or null. One indexed D1 read, for share sessions only.
export async function recheckAdmittedLink(
  env: Env,
  admitted: AdmittedLink,
): Promise<{ kind: ShareLinkChange; code: string } | null> {
  const link = await shareLinkForDocument(env, admitted.shareCode, admitted.documentId);
  const kind = shareLinkChange(admitted, link);
  return kind ? { kind, code: admitted.shareCode } : null;
}
