// What this editor hands the shared linked-chart host (lib/sheet-link-bindings.ts): the document's grant as its token
// alone (null without one), and each event as its own literal telemetry call.
import { afterEach, describe, expect, it, vi } from 'vitest';

const { documentGrant, track } = vi.hoisted(() => ({ documentGrant: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/api/document-grants', () => ({ documentGrant }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { sheetLinkGrantOf, trackSheetLink } from './sheet-link-bindings';

afterEach(() => vi.clearAllMocks());

describe('sheet link bindings', () => {
  it("answers the document's grant token, or null without one", async () => {
    documentGrant.mockResolvedValueOnce({ grant: 'G' });
    expect(await sheetLinkGrantOf('x1')).toBe('G');
    expect(documentGrant).toHaveBeenCalledWith('x1');
    documentGrant.mockResolvedValueOnce(null);
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
