import { apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { randomColor, randomName, type Participant } from '@/lib/identity';

// Who is opening the editor (docs/specs/014-identity/auth-and-guest-access.md), resolved once auth has
// settled: the account id when signed in, else the guest's SERVER-SIGNED id (minting one on a first
// visit, upgrading a legacy unsigned id) so the eventual sign-up migrate can prove possession; then
// the stored profile, seeded on a first visit. Lifted out of useIdentityBootstrap so a
// design in This Browser can open first and resolve this in the background
// (docs/specs/006-design/offline-mode.md "Instant open").
export async function resolveParticipant(opts: {
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // Called once the id is known and the row is being fetched (the load watchdog's step).
  onParticipantStep?: () => void;
}): Promise<Participant> {
  const { accountUserId, accountDisplayName } = opts;
  const selfId = accountUserId ?? (await ensureSignedGuestIdentity()).id;
  opts.onParticipantStep?.();
  // `undefined` when the profile could not be read (the api or the accounts Worker unreachable):
  // the session goes on under a stand-in, and nothing is saved over a profile that may well exist.
  const storedSelf = await apiLoadSelf(selfId).catch(() => undefined);
  // The profile is kept with the liveworkspace account (docs/specs/014-identity/auth-and-guest-access.md
  // "Display name"), so a name set in any app is the one shown here. A first visit seeds it: a
  // signed-in person's account name (which the api reads as the account's own and does not pin) and
  // a colour; a guest's random placeholder.
  const self: Participant = {
    ...(storedSelf ?? {
      id: selfId,
      name: (accountUserId && accountDisplayName) || randomName(),
      color: randomColor(),
    }),
    status: 'online',
  };
  if (storedSelf === null) await apiSaveSelf(self).catch(() => {});
  return self;
}
