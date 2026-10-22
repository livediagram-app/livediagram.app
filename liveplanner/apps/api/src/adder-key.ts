// The adder key (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint SR4): the id the room stamps as
// `addedBy` on a sticky or text element a Participant adds, so that Participant may later delete it and nothing
// else. Derived on the server from the caller's identity on the project, never read from a request: stable for
// one person on one project across devices, opaque, and different on every project.

import { ADDER_KEY_LENGTH } from '@liveplanner/project';
import { sha256Hex } from '@liveplanner/api-schema';

export async function adderKeyFor(projectId: string, ownerId: string): Promise<string> {
  const digest = await sha256Hex(
    new TextEncoder().encode(`liveplanner:adder:v1:${projectId}:${ownerId}`),
  );
  return digest.slice(0, ADDER_KEY_LENGTH);
}
