import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/026-plan/public-roadmap.md "Managing a roadmap": the dialog's three calls, as the owner, never through a
// share link.
const core = vi.hoisted(() => ({
  API_BASE: 'https://api.test/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response): Promise<unknown> => (await res.json()) as unknown),
  expectOkVoid: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api/core', () => core);

const { readRoadmaps, saveRoadmap, unpublishRoadmap } = await import('./roadmap-client');

const SCOPE = { ownerId: 'u1', projectId: 'p 1' };
afterEach(() => vi.clearAllMocks());

describe('roadmap client', () => {
  it('reads, saves and unpublishes with no share link', async () => {
    core.apiFetch.mockResolvedValue(new Response('{"roadmaps":[]}'));
    await readRoadmaps(SCOPE);
    expect(core.apiFetch).toHaveBeenLastCalledWith('https://api.test/api/projects/p%201/roadmaps', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(core.apiHeaders).toHaveBeenLastCalledWith('u1', { share: null, body: false });
    const settings = {
      title: 'R',
      columns: ['todo'],
      types: ['task'],
      fields: [],
      voting: true,
      formCode: null,
    };
    core.apiFetch.mockResolvedValue(new Response('{"roadmap":{}}'));
    await saveRoadmap(SCOPE, 'b/1', settings);
    expect(core.apiFetch).toHaveBeenLastCalledWith(
      'https://api.test/api/projects/p%201/roadmaps/b%2F1',
      { method: 'PUT', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(settings) },
    );
    expect(core.apiHeaders).toHaveBeenLastCalledWith('u1', { share: null, body: true });
    core.apiFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await unpublishRoadmap(SCOPE, 'b1');
    expect(core.apiFetch.mock.lastCall![1]).toMatchObject({ method: 'DELETE' });
  });
});
