// Words the tag surfaces share (docs/specs/013-workspace/tags.md "The Tags page"). Pure.

/** A tag's project count, as its heading and panel section show it. */
export function projectCountLabel(n: number): string {
  return n === 1 ? '1 plan' : `${n} plans`;
}
