'use client';

// Re-read a view that lists the person's documents once an old livediagram.app guest's work has been merged into
// them (docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site"). A second's
// grace first gives the index's merge time to land.

import { useAfterApiWrite } from './useAfterApiWrite';

const fromClaim = (signal: { claimed?: true }) => signal.claimed === true;

export function useAfterLegacyClaim(onChange: () => void, enabled = true): void {
  useAfterApiWrite(() => onChange(), { enabled, filter: fromClaim });
}
