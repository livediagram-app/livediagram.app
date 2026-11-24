// Who is offered a suggestion (liveworkspace/docs/specs/016-notifications/suggestions.md "Only what the person can
// do"): an Editor of the item, signed in to an account, in a session that is not Offline, an embed or a Community copy.
// Never a Participant, a Viewer or a guest. The action's own checks still run when it is taken.

export type SuggestSession = {
  // The share role's level, as each editor's `can.level` says it.
  level: string;
  // The editor's read-only flag (a locked item, a view link).
  readOnly: boolean;
  // An account in person (a guest is not one).
  signedIn: boolean;
  offline?: boolean;
  embed?: boolean;
  community?: boolean;
};

export function maySuggestTo(session: SuggestSession): boolean {
  return (
    session.level === 'edit' &&
    !session.readOnly &&
    session.signedIn &&
    !session.offline &&
    !session.embed &&
    !session.community
  );
}
