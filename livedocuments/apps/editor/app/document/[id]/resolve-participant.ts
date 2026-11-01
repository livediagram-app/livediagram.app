import { apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import { ensureGuestIdentity } from '@/lib/guest-identity';
import { randomColor, randomName, type Participant } from '@/lib/identity';

// Who is opening the editor (docs/specs/014-identity/auth-and-guest-access.md), resolved once auth has
// settled: the account id when signed in, else the guest's SERVER-SIGNED id (minting one on a first
// visit, upgrading a legacy unsigned id) so the eventual sign-up migrate can prove possession; then
// the stored profile, seeded on a first visit. Lifted out of useIdentityBootstrap so a
// document in This Browser can open first and resolve this in the background
// (docs/specs/006-document/offline-mode.md "Instant open").
// The name a first visit with no profile is seeded with (docs/specs/014-identity/auth-and-guest-access.md): the
// account name when signed in, else the guest's random placeholder. /new seeds with it too, so a signed-in
// person's first document never gives them a random name that then wins in every app.
export function firstVisitName(
  accountUserId: string | null | undefined,
  accountDisplayName: string | null | undefined,
  guestName: string,
): string {
  return (accountUserId && accountDisplayName) || guestName;
}

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
  // its own already answers with its account name, and a name set here, in Settings › Profile or in
  // another app wins over it (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"). So a stored profile is used
  // as it is, never overwritten with the account name; only a first visit with none seeds one, with
  // the account name when signed in and a random placeholder for a guest.
  if (storedSelf) return { ...storedSelf, status: 'online' };
  const self: Participant = {
    id: selfId,
    name: firstVisitName(accountUserId, accountDisplayName, randomName()),
    color: randomColor(),
    status: 'online',
  };
  await apiSaveSelf(self).catch(() => {});
  return self;
}
