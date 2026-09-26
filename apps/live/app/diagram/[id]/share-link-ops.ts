// A share link changed under a live session: revoked (docs/specs/013-workspace/share-password.md) or rescoped
// (docs/specs/013-workspace/tab-scoped-share-links.md). Only a session that hydrated with that exact code
// reacts, and only to the worker (`from: 'system'`): the room refuses these
// kinds from client sockets, so the sender check is defence in depth against a
// forged force-redirect.
export type ShareLinkOp = { kind: 'share-revoked' | 'share-rescoped'; code: string };

export function shareLinkOpEffect(
  op: ShareLinkOp,
  from: string,
  sessionShareCode: string | null,
): 'leave' | 'reload' | null {
  if (from !== 'system' || !sessionShareCode || sessionShareCode !== op.code) return null;
  return op.kind === 'share-revoked' ? 'leave' : 'reload';
}
