import { apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { randomColor, randomName, type Participant } from '@/lib/identity';

// Who is opening the editor (docs/specs/014-identity/auth-and-guest-access.md), resolved once auth has
// settled: the Clerk userId when signed in, else the guest's SERVER-SIGNED id (minting one on a first
// visit, upgrading a legacy unsigned id) so the eventual sign-up migrate can prove possession; then
// the stored participant row, seeded or re-synced as needed. Lifted out of useIdentityBootstrap so a
// Local only document can open first and resolve this in the background
// (docs/specs/006-document/offline-mode.md "Instant open").
export async function resolveParticipant(opts: {
  clerkUserId: string | null | undefined;
  clerkDisplayName: string | null | undefined;
  // Called once the id is known and the row is being fetched (the load watchdog's step).
  onParticipantStep?: () => void;
}): Promise<Participant> {
  const { clerkUserId, clerkDisplayName } = opts;
  const selfId = clerkUserId ?? (await ensureSignedGuestIdentity()).id;
  opts.onParticipantStep?.();
  const storedSelf = await apiLoadSelf(selfId).catch(() => null);
  // Signed-in users always use their Clerk-known name on the
  // participant record. For a brand-new participant (no storedSelf)
  // this seeds the row; for an existing one we overwrite so it stays
  // in sync with the user's Clerk profile. Guests keep the existing
  // random placeholder so their chosen identity isn't blown away.
  const baseSelf: Participant = storedSelf ?? {
    id: selfId,
    name: randomName(),
    color: randomColor(),
    status: 'online',
  };
  const self: Participant =
    clerkUserId && clerkDisplayName
      ? { ...baseSelf, name: clerkDisplayName, status: 'online' }
      : { ...baseSelf, status: 'online' };
  // Persist on first load, or when a signed-in user's Clerk display
  // name has drifted from what we have on the server.
  const nameDrifted = !!(
    storedSelf &&
    clerkUserId &&
    clerkDisplayName &&
    storedSelf.name !== clerkDisplayName
  );
  if (!storedSelf || nameDrifted) await apiSaveSelf(self).catch(() => {});
  return self;
}
