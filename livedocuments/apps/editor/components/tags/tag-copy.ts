// Words the tag surfaces share (docs/specs/013-workspace/tags.md "The Tags page"). Pure.

/** A tag's document count, as its heading and panel section show it. */
export function documentCountLabel(n: number): string {
  return n === 1 ? '1 document' : `${n} documents`;
}
