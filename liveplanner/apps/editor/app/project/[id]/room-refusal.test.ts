import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@liveplanner/api-schema';
import { ProjectTrashedError } from '@/lib/project-trashed';

// A join the room turned away is explained over REST (docs/specs/013-workspace/trash.md): the editor repeats
// its own load (the share link for a visitor, the project for everyone else) and only a trashed answer
// counts. Anything else (a network blip, a password gate) leaves the editor as it is.
const apiLoadShared = vi.fn<typeof import('@/lib/api-client').apiLoadShared>();
const apiLoadProject = vi.fn<typeof import('@/lib/api-client').apiLoadProject>();
vi.mock('@/lib/api-client', () => ({
  apiLoadShared: (...a: Parameters<typeof apiLoadShared>) => apiLoadShared(...a),
  apiLoadProject: (...a: Parameters<typeof apiLoadProject>) => apiLoadProject(...a),
}));
const { joinRefusedBecauseTrashed } = await import('./room-refusal');

beforeEach(() => {
  apiLoadShared.mockReset();
  apiLoadProject.mockReset();
});

describe('joinRefusedBecauseTrashed', () => {
  it('asks for the project as its owner, and names a trashed one', async () => {
    apiLoadProject.mockRejectedValue(new ProjectTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ projectId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(true);
    expect(apiLoadProject).toHaveBeenCalledWith('me', 'd1');
    expect(apiLoadShared).not.toHaveBeenCalled();
  });

  it('asks through the share link for a visitor', async () => {
    apiLoadShared.mockRejectedValue(new ProjectTrashedError('d1'));
    await expect(
      joinRefusedBecauseTrashed({ projectId: 'd1', selfId: 'me', shareCode: 'abc' }),
    ).resolves.toBe(true);
    expect(apiLoadShared).toHaveBeenCalledWith('abc', 'me');
  });

  it('is not trashed when the project still loads, or the load fails for another reason', async () => {
    apiLoadProject.mockResolvedValue({ id: 'd1' } as Project);
    await expect(
      joinRefusedBecauseTrashed({ projectId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
    apiLoadProject.mockRejectedValue(new Error('network'));
    await expect(
      joinRefusedBecauseTrashed({ projectId: 'd1', selfId: 'me', shareCode: null }),
    ).resolves.toBe(false);
  });
});
