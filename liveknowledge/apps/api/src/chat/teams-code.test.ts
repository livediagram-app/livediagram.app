import { describe, expect, it } from 'vitest';

import { newTeamsCode } from './teams-code';

describe('newTeamsCode', () => {
  it('is eight letters from the readable alphabet, split by a dash', () => {
    for (let i = 0; i < 50; i++)
      expect(newTeamsCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it('draws again for a byte past the last whole alphabet, so no letter is favoured', () => {
    // 248 to 255 would wrap onto the first letters: each is skipped and a second draw fills the code.
    const draws = [
      [248, 255, 0, 1, 2, 3, 30, 31],
      [32, 247, 4, 5, 6, 7, 8, 9],
    ];
    let call = 0;
    const random = (bytes: Uint8Array) => {
      bytes.set(draws[call++] ?? []);
      return bytes;
    };
    expect(newTeamsCode(random)).toBe('ABCD-9AB9');
    expect(call).toBe(2);
  });
});
