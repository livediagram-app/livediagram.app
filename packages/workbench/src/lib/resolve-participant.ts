// Who is opening the editor (docs/specs/014-identity/auth-and-guest-access.md), resolved once auth has settled: the
// account id when signed in, else the guest token's id (fetching one from the accounts site on a first visit); then
// the stored profile, seeded on a first visit. Lifted out of useIdentityBootstrap so an item in This Browser can open
// first and resolve this in the background (docs/specs/006-document/offline-mode.md "Instant open"). Each editor binds
// it once, in its `resolve-participant.ts` beside its editor page.

// The name a first visit with no profile is seeded with (docs/specs/014-identity/auth-and-guest-access.md): the
// account name when signed in, else the guest's random placeholder. /new seeds with it too, so a signed-in
// person's first item never gives them a random name that then wins in every app.
export function firstVisitName(
  accountUserId: string | null | undefined,
  accountDisplayName: string | null | undefined,
  guestName: string,
): string {
  return (accountUserId && accountDisplayName) || guestName;
}

type SelfFields = { id: string; name: string; color: string; status: string };

// The editor's self calls (lib/api-client), guest identity (lib/guest-identity) and placeholder names (lib/identity).
export type ResolveParticipantDeps<Participant extends SelfFields> = {
  apiLoadSelf: (id: string) => Promise<Participant | null>;
  apiSaveSelf: (p: Participant) => Promise<void>;
  ensureGuestIdentity: () => Promise<{ id: string }>;
  randomName: () => string;
  randomColor: () => string;
};

export function createResolveParticipant<Participant extends SelfFields>(
  deps: ResolveParticipantDeps<Participant>,
) {
  return async function resolveParticipant(opts: {
    accountUserId: string | null | undefined;
    accountDisplayName: string | null | undefined;
    // Called once the id is known and the row is being fetched (the load watchdog's step).
    onParticipantStep?: () => void;
  }): Promise<Participant> {
    const { accountUserId, accountDisplayName } = opts;
    const selfId = accountUserId ?? (await deps.ensureGuestIdentity()).id;
    opts.onParticipantStep?.();
    const storedSelf = await deps.apiLoadSelf(selfId).catch(() => null);
    // The profile is liveworkspace's, one per person across every app: an account with no name of its own already
    // answers with its account name, and a name set here, in Settings › Profile or in another app wins over it
    // (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"). So a stored profile is used as it is, never
    // overwritten with the account name; only a first visit with none seeds one, with the account name when signed
    // in and a random placeholder for a guest.
    if (storedSelf) return { ...storedSelf, status: 'online' };
    const self = {
      id: selfId,
      name: firstVisitName(accountUserId, accountDisplayName, deps.randomName()),
      color: deps.randomColor(),
      status: 'online',
    } as Participant;
    await deps.apiSaveSelf(self).catch(() => {});
    return self;
  };
}
