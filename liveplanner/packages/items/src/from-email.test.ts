import { describe, expect, it } from 'vitest';
import { FROM_EMAIL_MAX, fromEmailValue, readFromEmail } from './from-email';
import { readStoredHistory } from './item-history';

describe('from-email', () => {
  it('keeps an address, lower-cased and trimmed', () => {
    expect(fromEmailValue(' Ada@Example.com ')).toBe('ada@example.com');
    expect(readFromEmail('ada@example.com')).toBe('ada@example.com');
  });

  it('refuses what cannot be an address', () => {
    for (const v of ['', 'ada', '@example.com', 'ada@', `${'a'.repeat(FROM_EMAIL_MAX)}@x`])
      expect(fromEmailValue(v)).toBeNull();
    expect(readFromEmail(42)).toBeNull();
    expect(readFromEmail(undefined)).toBeNull();
  });

  it('reads an email card history entry with its tag', () => {
    const entry = readStoredHistory({
      at: 1,
      by: JSON.stringify({ id: 'email:abc', name: 'ada@example.com', color: '#0f766e' }),
      tag: 'email',
      changes: JSON.stringify([{ kind: 'created', status: 'todo' }]),
    });
    expect(entry?.tag).toBe('email');
  });
});
