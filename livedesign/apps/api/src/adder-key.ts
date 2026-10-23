// The adder key (docs/specs/013-workspace/share-roles.md "Integrity"; blueprint SR4): the id the room stamps as
// `addedBy` on a sticky or text element a Participant adds, so that Participant may later delete it and nothing
// else. Derived on the server from the caller's identity on the design, never read from a request: stable for
// one person on one design across devices, opaque, and different on every design.

import { ADDER_KEY_LENGTH } from '@livedesign/design';
import { sha256Hex } from '@livedesign/api-schema';

export async function adderKeyFor(designId: string, ownerId: string): Promise<string> {
  const digest = await sha256Hex(
    new TextEncoder().encode(`livedesign:adder:v1:${designId}:${ownerId}`),
  );
  return digest.slice(0, ADDER_KEY_LENGTH);
}
