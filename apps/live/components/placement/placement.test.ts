import { describe, expect, it } from 'vitest';
import { parsePlacement, placementValue } from './PlacementBrowser';

// The placement string is the browser's selection wire format, shared by
// the New Diagram wizard (spec/76) and the move-to-folder dialog (spec/15).
// Pin the four shapes and that value -> parse round-trips, so neither
// consumer can drift from the other.
describe('placement strings', () => {
  const cases: { teamId: string | null; folderId: string | null; value: string }[] = [
    { teamId: null, folderId: null, value: 'unsorted' },
    { teamId: null, folderId: 'f1', value: 'folder:f1' },
    { teamId: 't1', folderId: null, value: 'team:t1' },
    { teamId: 't1', folderId: 'f1', value: 'team:t1:folder:f1' },
  ];

  it.each(cases)('encodes { $teamId, $folderId } as $value', ({ teamId, folderId, value }) => {
    expect(placementValue(teamId, folderId)).toBe(value);
  });

  it.each(cases)('round-trips $value', ({ teamId, folderId, value }) => {
    expect(parsePlacement(value)).toEqual({ teamId, folderId });
  });

  it('parses unknown strings as the personal root', () => {
    expect(parsePlacement('')).toEqual({ teamId: null, folderId: null });
  });
});
