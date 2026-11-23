// A publish the owner's tier refused (docs/specs/026-plan/public-roadmap.md "Tiers"; 409 `roadmap_limit_reached`, Pro
// on only): what the owner has published and the most their tier allows, as the refusal carried them, for the dialog
// to say in the api's own numbers.

import type { RoadmapErrorBody } from '@liveplanner/api-schema';

export class RoadmapLimitReached extends Error {
  readonly used: number;
  readonly max: number;
  /** The plan is a guest's: Free's limit in this plan alone, and nobody to offer an upgrade. */
  readonly guest: boolean;
  constructor(used: number, max: number, guest = false) {
    super('roadmap_limit_reached');
    this.name = 'RoadmapLimitReached';
    this.used = used;
    this.max = max;
    this.guest = guest;
  }
}

/** The refusal a 409 holds, or null when it is another one (or names no numbers). */
export async function roadmapLimitOf(res: Response): Promise<RoadmapLimitReached | null> {
  if (res.status !== 409) return null;
  try {
    const body = (await res.clone().json()) as Partial<RoadmapErrorBody>;
    return body.error === 'roadmap_limit_reached' &&
      typeof body.used === 'number' &&
      typeof body.max === 'number'
      ? new RoadmapLimitReached(body.used, body.max, body.guest === true)
      : null;
  } catch {
    return null;
  }
}
