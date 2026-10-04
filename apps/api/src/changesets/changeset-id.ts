import { CHANGESET_ID_LENGTH } from '@livediagram/api-schema';

// Lowercase Crockford base32: no i, l, o or u, so an id read aloud or retyped survives (CS7).
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

// A changeset id (docs/specs/024-agents/agent-changesets.md "What a changeset is"): `cs_` and 10
// characters, 5 random bits each. A collision with an existing record is refused by the primary
// key, and the pipeline mints again once (CS7).
export function mintChangesetId(
  random: (length: number) => Uint8Array = (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
): string {
  const bytes = random(CHANGESET_ID_LENGTH);
  let id = 'cs_';
  for (let i = 0; i < CHANGESET_ID_LENGTH; i += 1) id += ALPHABET[(bytes[i] ?? 0) & 31];
  return id;
}
