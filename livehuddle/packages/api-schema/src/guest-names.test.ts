import { describe, expect, it } from 'vitest';
import { GUEST_NAME_ADJECTIVES, GUEST_NAME_ANIMALS, guestNameForKey } from './guest-names';

describe('guestNameForKey', () => {
  it('gives a key the same two-word name every time', () => {
    for (const key of ['0f3a9c', 'user_abc', '', 'a'.repeat(64)]) {
      const name = guestNameForKey(key);
      expect(guestNameForKey(key)).toBe(name);
      const [adjective, animal] = name.split(' ');
      expect(GUEST_NAME_ADJECTIVES).toContain(adjective);
      expect(GUEST_NAME_ANIMALS).toContain(animal);
    }
  });

  it('spreads keys over the names', () => {
    const names = new Set(Array.from({ length: 200 }, (_, i) => guestNameForKey(`key-${i}`)));
    expect(names.size).toBeGreaterThan(50);
  });
});
