import { describe, expect, it } from 'vitest';
import { cutParticipantName, MAX_PARTICIPANT_NAME_LEN } from './participants';

describe('cutParticipantName', () => {
  it('cuts at the cap, never through an emoji', () => {
    expect(cutParticipantName('Ada')).toBe('Ada');
    const name = `${'a'.repeat(MAX_PARTICIPANT_NAME_LEN - 1)}😀`;
    expect(cutParticipantName(name)).toBe('a'.repeat(MAX_PARTICIPANT_NAME_LEN - 1));
  });
});
