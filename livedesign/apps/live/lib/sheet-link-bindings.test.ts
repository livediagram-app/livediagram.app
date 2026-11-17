// What this editor hands the shared linked-chart host (lib/sheet-link-bindings.ts): the design's grant as its token
// alone (null without one), and each event as its own literal telemetry call.
import { afterEach, describe, expect, it, vi } from 'vitest';

const { designGrant, track } = vi.hoisted(() => ({ designGrant: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/api/design-grants', () => ({ designGrant }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { sheetLinkGrantOf, trackSheetLink } from './sheet-link-bindings';

afterEach(() => vi.clearAllMocks());

describe('sheet link bindings', () => {
  it("answers the design's grant token, or null without one", async () => {
    designGrant.mockResolvedValueOnce({ grant: 'G' });
    expect(await sheetLinkGrantOf('x1')).toBe('G');
    expect(designGrant).toHaveBeenCalledWith('x1');
    designGrant.mockResolvedValueOnce(null);
    expect(await sheetLinkGrantOf('x1')).toBeNull();
  });

  it('sends Link and Unlink as Element Changed', () => {
    trackSheetLink('ChartSheetLink');
    trackSheetLink('ChartSheetUnlink');
    expect(track.mock.calls).toEqual([
      ['Element', 'Changed', 'ChartSheetLink'],
      ['Element', 'Changed', 'ChartSheetUnlink'],
    ]);
  });
});
