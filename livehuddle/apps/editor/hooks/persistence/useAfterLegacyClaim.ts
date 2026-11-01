'use client';

// Re-read a view that lists the person's documents once an old livehuddle.app guest's work has been merged into
// them (docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site"). The same
// after-write beat as the Timeline's, which gives the index's merge a second to land.

import { useAfterApiWrite } from './useAfterApiWrite';

const fromClaim = (signal: { claimed?: true }) => signal.claimed === true;

export function useAfterLegacyClaim(onChange: () => void, enabled = true): void {
  useAfterApiWrite(() => onChange(), { enabled, filter: fromClaim });
}
