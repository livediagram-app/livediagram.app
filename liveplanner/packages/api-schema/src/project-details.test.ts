import { describe, expect, it } from 'vitest';
import { PROJECT_DESCRIPTION_MAX, readProjectDescription } from './project-details';

// docs/specs/026-plan/plan-overview.md "The description".
describe('readProjectDescription', () => {
  it('trims a description and keeps its line breaks', () => {
    expect(readProjectDescription('  Where bugs land.\nThen fixed.  ')).toBe(
      'Where bugs land.\nThen fixed.',
    );
  });

  it('reads anything but a string as empty', () => {
    expect(readProjectDescription(undefined)).toBe('');
    expect(readProjectDescription(null)).toBe('');
    expect(readProjectDescription(42)).toBe('');
  });

  it('caps a long description at the limit', () => {
    const long = 'a'.repeat(PROJECT_DESCRIPTION_MAX + 50);
    expect(readProjectDescription(long)).toHaveLength(PROJECT_DESCRIPTION_MAX);
  });

  it('never keeps half of a character cut at the limit', () => {
    const text = `${'a'.repeat(PROJECT_DESCRIPTION_MAX - 1)}😀 more`;
    const read = readProjectDescription(text);
    expect(read).toBe('a'.repeat(PROJECT_DESCRIPTION_MAX - 1));
  });

  it('drops the space a cut leaves at the end', () => {
    const text = `${'a'.repeat(PROJECT_DESCRIPTION_MAX - 1)} b`;
    expect(readProjectDescription(text)).toBe('a'.repeat(PROJECT_DESCRIPTION_MAX - 1));
  });
});
