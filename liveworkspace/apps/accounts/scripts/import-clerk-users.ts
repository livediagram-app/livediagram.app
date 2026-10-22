// Turns a Clerk user export (Dashboard → Users → Export, CSV) into SQL that creates the
// same accounts here, keeping each Clerk id as the account id. Documents in livediagram
// and liveplanner are keyed by that id, so nothing in their databases has to move.
//
//   node scripts/import-clerk-users.ts users.csv > clerk-import.sql
//   wrangler d1 execute liveworkspace-accounts --remote --file clerk-import.sql
//
// Only the email is carried over: sign-in is by email code, so there are no passwords to
// migrate, and Google accounts sign in with a code to the same address. Re-running is safe:
// an id or email that already exists is skipped.
import { readFileSync } from 'node:fs';
import { parseCsv } from './csv.ts';

export interface ClerkUser {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  // ISO 8601, the way Better Auth stores dates in SQLite.
  createdAt: string;
}

export function clerkUsersFromCsv(csv: string): { users: ClerkUser[]; skipped: string[] } {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return { users: [], skipped: [] };
  const column = (name: string) => header.indexOf(name);
  const idAt = column('id');
  const emailAt = column('primary_email_address');
  if (idAt < 0 || emailAt < 0) {
    throw new Error('Expected a Clerk export with `id` and `primary_email_address` columns');
  }
  const firstAt = column('first_name');
  const lastAt = column('last_name');
  const verifiedAt = column('verified_email_addresses');
  const createdAt = column('created_at');

  const users: ClerkUser[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const id = row[idAt]?.trim() ?? '';
    const email = row[emailAt]?.trim().toLowerCase() ?? '';
    if (!id.startsWith('user_') || !email.includes('@')) {
      if (id) skipped.push(id);
      continue;
    }
    const name = [row[firstAt] ?? '', row[lastAt] ?? ''].join(' ').trim();
    const verifiedList = (row[verifiedAt] ?? '').toLowerCase();
    const created = Date.parse(row[createdAt] ?? '');
    users.push({
      id,
      email,
      name,
      // Clerk only lets an address be primary once it is verified, so a missing column
      // counts as verified; a present one is checked.
      verified: verifiedAt < 0 || verifiedList.includes(email),
      createdAt: new Date(Number.isFinite(created) ? created : Date.now()).toISOString(),
    });
  }
  return { users, skipped };
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function importSql(users: ClerkUser[]): string {
  const now = new Date().toISOString();
  return users
    .map(
      (u) =>
        `INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt") ` +
        `VALUES (${sqlString(u.id)}, ${sqlString(u.name)}, ${sqlString(u.email)}, ${u.verified ? 1 : 0}, NULL, ${sqlString(u.createdAt)}, ${sqlString(now)});`,
    )
    .join('\n');
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node scripts/import-clerk-users.ts <clerk-export.csv> > import.sql');
    process.exit(1);
  }
  const { users, skipped } = clerkUsersFromCsv(readFileSync(path, 'utf8'));
  process.stdout.write(`${importSql(users)}\n`);
  console.error(
    `${users.length} accounts${skipped.length ? `, skipped ${skipped.length} without an email: ${skipped.join(', ')}` : ''}`,
  );
}
