import { describe, expect, it } from 'vitest';
import { TIMELINE_PERSON_KEY_LENGTH, timelinePersonKey, timelinePersonKeys } from './event-key';

describe('timelinePersonKey', () => {
  it('is the same for one person every time, different for another, and hex of a fixed length', async () => {
    const ada = await timelinePersonKey('user_ada');
    expect(await timelinePersonKey('user_ada')).toBe(ada);
    expect(await timelinePersonKey('user_bea')).not.toBe(ada);
    expect(ada).toMatch(new RegExp(`^[0-9a-f]{${TIMELINE_PERSON_KEY_LENGTH}}$`));
    expect(ada).not.toContain('ada');
  });

  it('works out each person once, whatever the repeats', async () => {
    const keys = await timelinePersonKeys(['user_ada', 'user_bea', 'user_ada']);
    expect([...keys.keys()]).toEqual(['user_ada', 'user_bea']);
    expect(keys.get('user_bea')).toBe(await timelinePersonKey('user_bea'));
  });
});
