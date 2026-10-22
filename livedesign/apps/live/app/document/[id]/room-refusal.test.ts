import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@livedesign/api-schema';
import { DocumentTrashedError } from '@/lib/document-trashed';

// A join the room turned away is explained over REST (docs/specs/013-workspace/trash.md): the editor repeats
// its own load (the share link for a visitor, the document for everyone else) and only a trashed answer
// counts. Anything else (a network blip, a password gate) leaves the editor as it is.
const apiLoadShared = vi.fn<typeof import('@/lib/api-client').apiLoadShared>();
const apiLoadDocument = vi.fn<typeof import('@/lib/api-client').apiLoadDocument>();
vi.mock('@/lib/api-client', () => ({
  apiLoadShared: (...a: Parameters<typeof apiLoadShared>) => apiLoadShared(...a),
  apiLoadDocument: (...a: Parameters<typeof apiLoadDocument>) => apiLoadDocument(...a),
}));
const { joinRefusedBecauseTrashed } = await import('./room-refusal');

beforeEach(() => {
  apiLoadShared.mockReset();
  apiLoadDocument.mockReset();
});

describe('joinRefusedBecauseTrashed', () => {
  it('asks for the document as its owner, and names a trashed one', async () => {
    apiLoadDocument.mockRejectedValue(new DocumentTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ documentId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(true);
    expect(apiLoadDocument).toHaveBeenCalledWith('me', 'd1');
    expect(apiLoadShared).not.toHaveBeenCalled();
  });

  it('asks through the share link for a visitor', async () => {
    apiLoadShared.mockRejectedValue(new DocumentTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ documentId: 'd1', selfId: 'me', shareCode: 'abc' }),
    ).resolves.toBe(true);
    expect(apiLoadShared).toHaveBeenCalledWith('abc', 'me');
  });

  it('is not trashed when the document still loads, or the load fails for another reason', async () => {
    apiLoadDocument.mockResolvedValue({ id: 'd1' } as LiveDoc);
    await expect(
      joinRefusedBecauseTrashed({ documentId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
    apiLoadDocument.mockRejectedValue(new Error('network'));
    await expect(
      joinRefusedBecauseTrashed({ documentId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
  });
});
