import { describe, expect, it } from 'vitest';
import { isRepairClearable } from '@livediagram/ui';
import { LOCAL_IDENTITY_KEYS } from './local-identity';
import { COMMUNITY_KEY_STORAGE } from '@livediagram/api-schema';

// docs/specs/007-editor/load-recovery.md "Repairing a browser": a repair keeps the guest identity. A
// new identity key added to local-identity.ts fails here until it is either kept by
// @livediagram/ui's REPAIR_KEPT_KEYS or listed below as deliberately clearable.
const CLEARABLE: ReadonlySet<string> = new Set([
  // Only gates a once-per-day telemetry signal; clearing it re-counts one day at most.
  LOCAL_IDENTITY_KEYS.lastActiveDay,
]);

describe('browser repair keeps the guest identity', () => {
  it.each(Object.entries(LOCAL_IDENTITY_KEYS))('%s', (_name, key) => {
    expect(isRepairClearable(key)).toBe(CLEARABLE.has(key));
  });

  it('keeps the community key', () => {
    expect(isRepairClearable(COMMUNITY_KEY_STORAGE)).toBe(false);
  });
});
