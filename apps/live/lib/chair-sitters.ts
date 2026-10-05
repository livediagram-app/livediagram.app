// Who is sitting in each chair, from presence, never from the document (docs/specs/008-canvas/avatar-mode.md):
// our own character plus every seated peer, keyed by chair id.

export type Sitter = { name: string; color: string };
export type ChairSitters = ReadonlyMap<string, readonly Sitter[]>;

export function sittersByChair(
  selfSeatedOn: string | null | undefined,
  selfColor: string,
  peers: readonly { name: string; color: string; seatedOn?: string | null }[],
): Map<string, Sitter[]> {
  const byChair = new Map<string, Sitter[]>();
  const add = (chairId: string, sitter: Sitter) => {
    const list = byChair.get(chairId);
    if (list) list.push(sitter);
    else byChair.set(chairId, [sitter]);
  };
  if (selfSeatedOn) add(selfSeatedOn, { name: 'You', color: selfColor });
  for (const peer of peers)
    if (peer.seatedOn) add(peer.seatedOn, { name: peer.name, color: peer.color });
  return byChair;
}

export function sameSitters(a: ChairSitters, b: ChairSitters): boolean {
  if (a.size !== b.size) return false;
  for (const [chair, list] of a) {
    const other = b.get(chair);
    if (!other || other.length !== list.length) return false;
    if (list.some((s, i) => s.name !== other[i]!.name || s.color !== other[i]!.color)) return false;
  }
  return true;
}
