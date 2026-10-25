// The owner map (docs/migration.md, step 1): every old owner id to the id it has on the new side. Every later step
// writes owners, members, grants and actors through it.
//
// - An account (a Clerk id, `user_…`) keeps its id, unless its email already has an account on the new side
//   (`existing-accounts.json`): then it is that account, so the person's old and new work land on one account.
// - A guest of the old site (a bare UUID) becomes `legacyGuestOwner(id)`, held by nobody until it is claimed (step 6).
// - A guest the old site already folded into an account (`owner_aliases`) is that account.
import { legacyGuestOwner } from '@liveworkspace/migration';
import { clerkUsersFromCsv, type ClerkUser } from '../../accounts/scripts/import-clerk-users.ts';

export type ExistingAccount = { id: string; email: string };

// A new-side guest id: `guest_` and a lower-case v4-shaped UUID (liveworkspace/apps/accounts/src/ids.ts GUEST_ID).
const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The accounts already on the new side, as `[{ id, email }]`, or as `wrangler d1 execute … --json` prints the
 *  answer to `SELECT id, email FROM "user"` (an array of `{ results: [...] }`). */
export function readExistingAccounts(text: string): ExistingAccount[] {
  const parsed = JSON.parse(text) as unknown;
  const rows: unknown[] = Array.isArray(parsed)
    ? (parsed as unknown[]).flatMap((entry): unknown[] =>
        entry &&
        typeof entry === 'object' &&
        Array.isArray((entry as { results?: unknown }).results)
          ? (entry as { results: unknown[] }).results
          : [entry],
      )
    : [];
  const out: ExistingAccount[] = [];
  for (const row of rows) {
    const r = row as { id?: unknown; email?: unknown };
    if (typeof r.id !== 'string' || typeof r.email !== 'string') {
      throw new Error('existing-accounts.json: every row needs an `id` and an `email`');
    }
    out.push({ id: r.id, email: r.email.trim().toLowerCase() });
  }
  return out;
}

export function readClerkUsers(csv: string): { users: ClerkUser[]; skipped: string[] } {
  return clerkUsersFromCsv(csv);
}

export type OwnerMatch = { clerkId: string; accountId: string; email: string };

/** An account the migration writes for or through: imported from Clerk, or already on the new side. */
export type AccountInfo = {
  id: string;
  email: string;
  name: string;
  /** Made by this migration (its Clerk row is imported); false for an account that already existed. */
  imported: boolean;
  clerk: ClerkUser | null;
};

export class OwnerMap {
  private readonly clerkTo = new Map<string, string>();
  private readonly accounts = new Map<string, AccountInfo>();
  private readonly aliases: ReadonlyMap<string, string>;
  readonly matches: OwnerMatch[] = [];
  /** Old account ids in the snapshot with no Clerk row and no account on the new side. */
  readonly unknownAccounts = new Set<string>();
  /** Old guest ids seen, and those that don't make a valid new guest id. */
  readonly guests = new Set<string>();
  readonly invalidGuests = new Set<string>();

  constructor(
    clerk: readonly ClerkUser[],
    existing: readonly ExistingAccount[],
    aliases: ReadonlyMap<string, string> = new Map(),
  ) {
    this.aliases = aliases;
    const byEmail = new Map<string, ExistingAccount>();
    for (const account of existing) {
      byEmail.set(account.email, account);
      this.accounts.set(account.id, {
        id: account.id,
        email: account.email,
        name: '',
        imported: false,
        clerk: null,
      });
    }
    // Sorted, so the matches and everything written from them come out in one order.
    for (const user of [...clerk].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      const taken = byEmail.get(user.email);
      if (taken && taken.id !== user.id) {
        this.clerkTo.set(user.id, taken.id);
        this.matches.push({ clerkId: user.id, accountId: taken.id, email: user.email });
        const info = this.accounts.get(taken.id)!;
        info.name ||= user.name;
        continue;
      }
      this.clerkTo.set(user.id, user.id);
      // An account an earlier run imported is on the new side under the same id: still this migration's own, and
      // its INSERT OR IGNORE changes nothing.
      this.accounts.set(user.id, {
        id: user.id,
        email: user.email,
        name: user.name,
        imported: true,
        clerk: user,
      });
    }
  }

  /** The new owner of an old owner id. */
  ownerOf(oldOwnerId: string): string {
    if (oldOwnerId.startsWith('user_')) {
      const mapped = this.clerkTo.get(oldOwnerId);
      if (mapped) return mapped;
      if (!this.accounts.has(oldOwnerId)) this.unknownAccounts.add(oldOwnerId);
      return oldOwnerId;
    }
    const account = this.aliases.get(oldOwnerId);
    if (account) return this.ownerOf(account);
    this.guests.add(oldOwnerId);
    const owner = legacyGuestOwner(oldOwnerId);
    if (!GUEST_ID.test(owner)) this.invalidGuests.add(oldOwnerId);
    return owner;
  }

  /** The account behind a new owner id, when there is one the new side has (or this migration makes). */
  account(newOwnerId: string): AccountInfo | undefined {
    return this.accounts.get(newOwnerId);
  }

  /** The accounts this migration makes, in id order. */
  importedAccounts(): AccountInfo[] {
    return [...this.accounts.values()]
      .filter((a) => a.imported)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /** The Clerk ids, each with the account it lands on, in id order. */
  clerkAccounts(): [clerkId: string, accountId: string][] {
    return [...this.clerkTo.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }

  toJSON(): object {
    return {
      accounts: Object.fromEntries(this.clerkAccounts()),
      matches: this.matches,
      aliases: Object.fromEntries(
        [...this.aliases.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([guest]) => [guest, this.ownerOf(guest)]),
      ),
      guests: Object.fromEntries(
        [...this.guests].sort().map((guest) => [guest, legacyGuestOwner(guest)]),
      ),
      unknownAccounts: [...this.unknownAccounts].sort(),
      invalidGuests: [...this.invalidGuests].sort(),
    };
  }
}
