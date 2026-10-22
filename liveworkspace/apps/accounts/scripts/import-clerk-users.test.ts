import { describe, expect, it } from 'vitest';
import { clerkUsersFromCsv, importSql } from './import-clerk-users.ts';

const HEADER = 'id,first_name,last_name,primary_email_address,verified_email_addresses,created_at';

describe('clerkUsersFromCsv', () => {
  it('keeps the Clerk id and lower-cases the email', () => {
    const { users, skipped } = clerkUsersFromCsv(
      `${HEADER}\nuser_2abc,Ada,Lovelace,Ada@Example.com,ada@example.com,2024-03-01T10:00:00Z\n`,
    );
    expect(skipped).toEqual([]);
    expect(users).toEqual([
      {
        id: 'user_2abc',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        verified: true,
        createdAt: '2024-03-01T10:00:00.000Z',
      },
    ]);
  });

  it('reads quoted fields with commas, quotes and newlines', () => {
    const { users } = clerkUsersFromCsv(
      `${HEADER}\r\nuser_2q,"O""Brien","Smith,\nJr",o@example.com,o@example.com,\r\n`,
    );
    expect(users[0]?.name).toBe('O"Brien Smith,\nJr');
  });

  it('skips rows without an email or a Clerk id', () => {
    const { users, skipped } = clerkUsersFromCsv(
      `${HEADER}\nuser_2none,A,B,,,\nnot-a-user,A,B,a@example.com,a@example.com,\n`,
    );
    expect(users).toEqual([]);
    expect(skipped).toEqual(['user_2none', 'not-a-user']);
  });

  it('marks an address unverified when the verified list leaves it out', () => {
    const { users } = clerkUsersFromCsv(`${HEADER}\nuser_2u,,,u@example.com,other@example.com,\n`);
    expect(users[0]?.verified).toBe(false);
  });

  it('refuses a file that is not a Clerk export', () => {
    expect(() => clerkUsersFromCsv('name,email\nA,a@example.com\n')).toThrow('Clerk export');
  });
});

describe('importSql', () => {
  it('escapes quotes and skips existing rows', () => {
    const sql = importSql([
      {
        id: 'user_2x',
        email: "o'neil@example.com",
        name: "O'Neil",
        verified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    expect(sql).toMatch(/^INSERT OR IGNORE INTO "user"/);
    expect(sql).toContain("'O''Neil', 'o''neil@example.com', 0, NULL, '2024-01-01T00:00:00.000Z'");
  });
});
