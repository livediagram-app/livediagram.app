import { describe, expect, it } from 'vitest';
import { presetColumnName } from './presets';

// A status no board names any more keeps the name its preset column gave it.
describe('presetColumnName', () => {
  it('names a preset column’s status, or one made from it', () => {
    expect(presetColumnName('wont-fix')).toBe('Won’t Fix');
    expect(presetColumnName('wont-fix~ab12')).toBe('Won’t Fix');
  });

  it('knows no name for a status no preset has', () => {
    expect(presetColumnName('custom-one~ab12')).toBeUndefined();
  });
});
