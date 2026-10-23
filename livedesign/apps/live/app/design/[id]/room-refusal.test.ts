import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDoc } from '@livedesign/api-schema';
import { DesignTrashedError } from '@/lib/design-trashed';

// A join the room turned away is explained over REST (docs/specs/013-workspace/trash.md): the editor repeats
// its own load (the share link for a visitor, the design for everyone else) and only a trashed answer
// counts. Anything else (a network blip, a password gate) leaves the editor as it is.
const apiLoadShared = vi.fn<typeof import('@/lib/api-client').apiLoadShared>();
const apiLoadDesign = vi.fn<typeof import('@/lib/api-client').apiLoadDesign>();
vi.mock('@/lib/api-client', () => ({
  apiLoadShared: (...a: Parameters<typeof apiLoadShared>) => apiLoadShared(...a),
  apiLoadDesign: (...a: Parameters<typeof apiLoadDesign>) => apiLoadDesign(...a),
}));
const { joinRefusedBecauseTrashed } = await import('./room-refusal');

beforeEach(() => {
  apiLoadShared.mockReset();
  apiLoadDesign.mockReset();
});

describe('joinRefusedBecauseTrashed', () => {
  it('asks for the design as its owner, and names a trashed one', async () => {
    apiLoadDesign.mockRejectedValue(new DesignTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ designId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(true);
    expect(apiLoadDesign).toHaveBeenCalledWith('me', 'd1');
    expect(apiLoadShared).not.toHaveBeenCalled();
  });

  it('asks through the share link for a visitor', async () => {
    apiLoadShared.mockRejectedValue(new DesignTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ designId: 'd1', selfId: 'me', shareCode: 'abc' }),
    ).resolves.toBe(true);
    expect(apiLoadShared).toHaveBeenCalledWith('abc', 'me');
  });

  it('is not trashed when the design still loads, or the load fails for another reason', async () => {
    apiLoadDesign.mockResolvedValue({ id: 'd1' } as LiveDoc);
    await expect(
      joinRefusedBecauseTrashed({ designId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
    apiLoadDesign.mockRejectedValue(new Error('network'));
    await expect(
      joinRefusedBecauseTrashed({ designId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
  });
});
