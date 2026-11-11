import { describe, expect, it } from 'vitest';
import { PERSON_EVENT_KEY_LENGTH, personEventKey, personEventKeys } from './event-key';

describe('personEventKey', () => {
  it('is the same for one person every time, different for another, and hex of a fixed length', async () => {
    const ada = await personEventKey('user_ada');
    expect(await personEventKey('user_ada')).toBe(ada);
    expect(await personEventKey('user_bea')).not.toBe(ada);
    expect(ada).toMatch(new RegExp(`^[0-9a-f]{${PERSON_EVENT_KEY_LENGTH}}$`));
    expect(ada).not.toContain('ada');
  });

  it('works out each person once, whatever the repeats', async () => {
    const keys = await personEventKeys(['user_ada', 'user_bea', 'user_ada']);
    expect([...keys.keys()]).toEqual(['user_ada', 'user_bea']);
    expect(keys.get('user_bea')).toBe(await personEventKey('user_bea'));
  });
});
