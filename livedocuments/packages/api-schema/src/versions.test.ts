import { describe, expect, it } from 'vitest';
import { restoreSummary } from './versions';

// A restore's changeset summary (docs/specs/006-document/version-history.md "Restore").
describe('restoreSummary', () => {
  it('names the version when it has a name, and caps a long one', () => {
    expect(restoreSummary(null)).toBe('Restored a version');
    expect(restoreSummary('')).toBe('Restored a version');
    expect(restoreSummary('Pitch')).toBe('Restored “Pitch”');
    const long = restoreSummary('x'.repeat(200));
    expect(long).toHaveLength(80);
    expect(long.endsWith('…”')).toBe(true);
  });
});
