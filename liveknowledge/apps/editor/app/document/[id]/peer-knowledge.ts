import type { RoomOp } from '@liveknowledge/api-schema';

// A page's own fields (`knowledge`: its owner, Verify and approval) reach an open editor from the api alone, as a
// `tab-meta` the room stamps `from: 'system'` after the api stored them (docs/specs/030-knowledgebase/verification.md
// "Share roles"). The room already drops them from every socket's op (room-api-only-fields.ts); this is the same
// rule on the receiving side, so a peer's op can never make a page look Verified, owned or unverified here.
//
// A peer's `tab-meta` loses `knowledge` from its patch and its `clear` list, and a peer's whole `tab` loses it from
// its tab (mergeRemoteTab keeps the page's own). Anything else, and every system op, comes back as it is.
export function withoutPeerKnowledge(from: string, op: RoomOp): RoomOp {
  if (from === 'system') return op;
  if (op.kind === 'tab-meta') {
    const patch = op.patch ?? {};
    const clears = Array.isArray(op.clear) && op.clear.includes('knowledge');
    if (!Object.hasOwn(patch, 'knowledge') && !clears) return op;
    const { knowledge: _peer, ...rest } = patch;
    void _peer;
    const clear = Array.isArray(op.clear) ? op.clear.filter((key) => key !== 'knowledge') : [];
    const { clear: _was, ...meta } = op;
    void _was;
    return { ...meta, patch: rest, ...(clear.length > 0 ? { clear } : {}) };
  }
  if (op.kind === 'tab' && op.tab && Object.hasOwn(op.tab, 'knowledge')) {
    const { knowledge: _peer, ...tab } = op.tab;
    void _peer;
    return { ...op, tab };
  }
  return op;
}
