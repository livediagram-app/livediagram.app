// Words the tag surfaces share (docs/specs/013-workspace/tags.md "The Tags page"). Pure.

/** A tag's design count, as its heading and panel section show it. */
export function designCountLabel(n: number): string {
  return n === 1 ? '1 design' : `${n} designs`;
}
