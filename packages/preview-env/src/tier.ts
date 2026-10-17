import type { PreviewTier } from './apps.ts';
import { PreviewError } from './errors.ts';
import { FULL_PREVIEW_LABEL } from './names.ts';

// Full preview when the PR touches the api (turbo's graph) or carries the label
// (docs/specs/016-platform/pr-previews.md "Choosing the tier").
export const API_PACKAGE = '@livediagram/api';

export type TierReason = 'graph' | 'label' | 'none';

export interface TierDecision {
  tier: PreviewTier;
  addLabel: boolean;
  reason: TierReason;
}

/** Package names from `turbo ls --output=json`. */
export function parseTurboLs(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PreviewError('bad-turbo', 'turbo ls printed something other than JSON');
  }
  const items = (parsed as { packages?: { items?: unknown } } | null)?.packages?.items;
  if (!Array.isArray(items))
    throw new PreviewError('bad-turbo', 'turbo ls JSON has no packages.items');
  return items.map((item) => {
    const name = (item as { name?: unknown } | null)?.name;
    if (typeof name !== 'string')
      throw new PreviewError('bad-turbo', 'a turbo ls item has no name');
    return name;
  });
}

export function decideTier(input: {
  affected: readonly string[];
  labels: readonly string[];
}): TierDecision {
  const graph = input.affected.includes(API_PACKAGE);
  const labelled = input.labels.includes(FULL_PREVIEW_LABEL);
  if (graph) return { tier: 'full', addLabel: !labelled, reason: 'graph' };
  if (labelled) return { tier: 'full', addLabel: false, reason: 'label' };
  return { tier: 'preview', addLabel: false, reason: 'none' };
}
