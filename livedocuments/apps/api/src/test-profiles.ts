// A stand-in for person/profiles.ts, for the suites that need people to have names and colours but are
// not about how they are read: `vi.mock('<path>/person/profiles', () => import('<path>/test-profiles'))`,
// then `setTestProfile(id, name, color)` where a fixture used to insert a participants row.
// person/profiles.test.ts tests the real module against a stand-in accounts Worker.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

import type { Env, ParticipantDTO } from './types';

export const DEFAULT_PARTICIPANT_COLOR = '#0ea5e9';
export const PROFILE_CACHE_MS = 60_000;

const people = new Map<string, ParticipantDTO>();

export function setTestProfile(
  id: string,
  name: string,
  color: string = DEFAULT_PARTICIPANT_COLOR,
  createdAt = 1,
): void {
  people.set(id, { id, name, color, createdAt });
}

export function clearTestProfiles(): void {
  people.clear();
}

export function __forgetProfiles(): void {}

export async function getParticipants(
  _env: Env,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, ParticipantDTO>> {
  const out = new Map<string, ParticipantDTO>();
  for (const id of ids) {
    const person = id ? people.get(id) : undefined;
    if (person) out.set(person.id, { ...person });
  }
  return out;
}

export async function getParticipant(_env: Env, id: string): Promise<ParticipantDTO | null> {
  const person = people.get(id);
  return person ? { ...person } : null;
}

export async function profileCreatedAt(_env: Env, id: string): Promise<number | null> {
  return people.get(id)?.createdAt ?? null;
}

export async function saveParticipant(
  _env: Env,
  id: string,
  patch: { name: string; color: string },
): Promise<ParticipantDTO> {
  const person = { id, ...patch, createdAt: people.get(id)?.createdAt ?? Date.now() };
  people.set(id, person);
  return { ...person };
}

