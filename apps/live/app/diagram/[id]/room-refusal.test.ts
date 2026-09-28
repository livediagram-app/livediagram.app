import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramTrashedError } from '@/lib/diagram-trashed';

// A join the room turned away is explained over REST (docs/specs/013-workspace/trash.md): the editor repeats
// its own load (the share link for a visitor, the diagram for everyone else) and only a trashed answer
// counts. Anything else (a network blip, a password gate) leaves the editor as it is.
const apiLoadShared = vi.fn();
const apiLoadDiagram = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiLoadShared: (...a: unknown[]) => apiLoadShared(...a),
  apiLoadDiagram: (...a: unknown[]) => apiLoadDiagram(...a),
}));
const { joinRefusedBecauseTrashed } = await import('./room-refusal');

beforeEach(() => {
  apiLoadShared.mockReset();
  apiLoadDiagram.mockReset();
});

describe('joinRefusedBecauseTrashed', () => {
  it('asks for the diagram as its owner, and names a trashed one', async () => {
    apiLoadDiagram.mockRejectedValue(new DiagramTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ diagramId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(true);
    expect(apiLoadDiagram).toHaveBeenCalledWith('me', 'd1');
    expect(apiLoadShared).not.toHaveBeenCalled();
  });

  it('asks through the share link for a visitor', async () => {
    apiLoadShared.mockRejectedValue(new DiagramTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ diagramId: 'd1', selfId: 'me', shareCode: 'abc' }),
    ).resolves.toBe(true);
    expect(apiLoadShared).toHaveBeenCalledWith('abc', 'me');
  });

  it('is not trashed when the diagram still loads, or the load fails for another reason', async () => {
    apiLoadDiagram.mockResolvedValue({ id: 'd1' });
    await expect(
      joinRefusedBecauseTrashed({ diagramId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
    apiLoadDiagram.mockRejectedValue(new Error('network'));
    await expect(
      joinRefusedBecauseTrashed({ diagramId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
  });
});
