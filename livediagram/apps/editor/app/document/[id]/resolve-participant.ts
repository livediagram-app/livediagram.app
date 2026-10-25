import { apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import { ensureGuestIdentity } from '@/lib/guest-identity';
import { randomColor, randomName, type Participant } from '@/lib/identity';

// Who is opening the editor (docs/specs/014-identity/auth-and-guest-access.md), resolved once auth has
// settled: the account id when signed in, else the guest token's id (fetching one from the accounts site on a first
// visit); then
// the stored profile, seeded on a first visit. Lifted out of useIdentityBootstrap so a
// document in This Browser can open first and resolve this in the background
// (docs/specs/006-document/offline-mode.md "Instant open").
export async function resolveParticipant(opts: {
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // Called once the id is known and the row is being fetched (the load watchdog's step).
  onParticipantStep?: () => void;
}): Promise<Participant> {
  const { accountUserId, accountDisplayName } = opts;
  const selfId = accountUserId ?? (await ensureGuestIdentity()).id;
  opts.onParticipantStep?.();
  const storedSelf = await apiLoadSelf(selfId).catch(() => null);
  // The profile is liveworkspace's, one per person across every app: an account with no name of
  // its own already answers with its account name, and a name set here or in another app wins
  // over it. So a stored profile is used as it is; only a first visit with none seeds one, with
  // the account name when signed in and a random placeholder for a guest.
  if (storedSelf) return { ...storedSelf, status: 'online' };
  const self: Participant = {
    id: selfId,
    name: (accountUserId && accountDisplayName) || randomName(),
    color: randomColor(),
    status: 'online',
  };
  await apiSaveSelf(self).catch(() => {});
  return self;
}
