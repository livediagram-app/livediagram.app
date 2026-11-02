import { describe, expect, it } from 'vitest';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings';
import { colorForKey } from './participant-colours';

describe('colorForKey', () => {
  it('is stable and always a palette colour', () => {
    for (const key of ['user_abc', 'guest', '', 'a@example.com']) {
      expect(colorForKey(key)).toBe(colorForKey(key));
      expect(PRESENCE_COLOUR_VALUES).toContain(colorForKey(key));
    }
  });
});
