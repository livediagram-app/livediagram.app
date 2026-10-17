import { ownerOf, type PrNumber } from './names.ts';

// PRs that still own resources but are no longer open
// (docs/specs/016-platform/pr-previews.md "Lifecycle", the sweeper).
export function sweepTargets(
  resourceNames: readonly string[],
  openPrs: readonly number[],
): PrNumber[] {
  const open = new Set(openPrs);
  const owners = new Set<PrNumber>();
  for (const name of resourceNames) {
    const pr = ownerOf(name);
    if (pr !== null && !open.has(pr)) owners.add(pr);
  }
  return [...owners].sort((a, b) => a - b);
}
