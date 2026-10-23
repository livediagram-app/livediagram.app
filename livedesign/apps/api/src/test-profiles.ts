import type { ParticipantDTO } from './types';
import type { StoredProfile } from './accounts/profiles';

// The profiles accounts/profiles.ts reads from the liveworkspace accounts Worker, held in memory for the
// route and db tests that only need someone to have a name. Swap the module in with:
//
//   vi.mock('../accounts/profiles', async () => (await import('../test-profiles')).fakeProfilesModule());
//
// then `seedProfile(id, name, color)` in a test. accounts/profiles.test.ts covers the real module against
// the accounts stand-in (test-accounts.ts).
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

const seeded = new Map<string, ParticipantDTO>();

export function seedProfile(id: string, name: string, color: string, createdAt = 1): void {
  seeded.set(id, { id, name, color, createdAt });
}

export function resetProfiles(): void {
  seeded.clear();
}

function stored(id: string): StoredProfile {
  const participant = seeded.get(id) ?? null;
  return { participant, ownSet: participant !== null, createdAt: participant?.createdAt ?? null };
}

export function fakeProfilesModule() {
  return {
    PROFILE_TTL_MS: 60_000,
    PROFILE_CACHE_MAX: 2000,
    readParticipants: async (_env: unknown, ids: Iterable<string>) => {
      const found = new Map<string, ParticipantDTO>();
      for (const id of ids) {
        const p = seeded.get(id);
        if (p) found.set(id, p);
      }
      return found;
    },
    readStoredProfiles: async (_env: unknown, ids: Iterable<string>) =>
      new Map([...ids].map((id) => [id, stored(id)])),
    getParticipant: async (_env: unknown, id: string) => seeded.get(id) ?? null,
    getStoredProfile: async (_env: unknown, id: string) => stored(id),
    writeParticipant: async (_env: unknown, id: string, next: { name: string; color: string }) => {
      seedProfile(id, next.name, next.color, seeded.get(id)?.createdAt ?? Date.now());
      return stored(id);
    },
    forgetProfiles: () => undefined,
    __forgetProfiles: () => undefined,
    participantOf: () => stored(''),
    ProfileError: class ProfileError extends Error {},
  };
}
