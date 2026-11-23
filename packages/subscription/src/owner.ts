// Who pays for an item (subscription.md "Who pays for an item"): its owner, written as the index writes a scope.

export type OwnerKind = 'person' | 'team';

/** `p:<accountId>` for a person, `t:<teamId>` for a team. */
export type OwnerScope = `p:${string}` | `t:${string}`;

export type Owner = { kind: OwnerKind; id: string };

/** Ids are account and team ids: short, and never holding a character a scope or a URL would need escaped. */
const OWNER_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function personScope(accountId: string): OwnerScope {
  return `p:${accountId}`;
}

export function teamScope(teamId: string): OwnerScope {
  return `t:${teamId}`;
}

/** The owner an item's head names: its team when it has one, otherwise the person who owns it. */
export function ownerScopeOf(ownerId: string, teamId: string | null | undefined): OwnerScope {
  return teamId ? teamScope(teamId) : personScope(ownerId);
}

/** A scope's parts, or null when it is not a well-formed owner scope. */
export function parseOwnerScope(value: unknown): Owner | null {
  if (typeof value !== 'string') return null;
  const kind = value.startsWith('p:') ? 'person' : value.startsWith('t:') ? 'team' : null;
  if (kind === null) return null;
  const id = value.slice(2);
  return OWNER_ID.test(id) ? { kind, id } : null;
}

export function isOwnerScope(value: unknown): value is OwnerScope {
  return parseOwnerScope(value) !== null;
}
