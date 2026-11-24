import { afterEach, describe, expect, it, vi } from 'vitest';

const submitChangeset = vi.fn<(a: unknown) => Promise<unknown>>();
const getDocument = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock('../changesets/submit', () => ({ submitChangeset: (a: unknown) => submitChangeset(a) }));
vi.mock('../db', () => ({ getDocument: (...a: unknown[]) => getDocument(...a) }));
vi.mock('../liveworkspace/profiles', () => ({
  getParticipant: async () => ({ name: 'Ada', color: '#123456' }),
}));

const { writeGraphTab } = await import('./graph-tab');

afterEach(() => vi.clearAllMocks());

const write = { tabId: 't1', name: 'Flow', elements: [], owner: 'user_ada' };

describe('writeGraphTab', () => {
  it('submits a replace of the elements as the person, through the changeset path', async () => {
    getDocument.mockResolvedValue({ id: 'd1' });
    submitChangeset.mockResolvedValue({ status: 200, body: {} });
    await expect(writeGraphTab({} as never, 'd1', write)).resolves.toEqual({ status: 'ok' });
    expect(submitChangeset).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: 't1',
        dryRun: false,
        tokenId: null,
        author: { id: 'user_ada', name: 'Ada', color: '#123456' },
        request: expect.objectContaining({
          body: { kind: 'replace', replace: { elements: [] }, name: 'Flow' },
        }),
      }),
    );
  });

  it('answers not_found for a canvas not started, and invalid_graph for a refusal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getDocument.mockResolvedValue(null);
    await expect(writeGraphTab({} as never, 'd1', write)).resolves.toEqual({
      status: 'not_found',
    });
    expect(submitChangeset).not.toHaveBeenCalled();
    getDocument.mockResolvedValue({ id: 'd1' });
    submitChangeset.mockResolvedValue({ status: 422, body: {} });
    await expect(writeGraphTab({} as never, 'd1', write)).resolves.toEqual({
      status: 'invalid_graph',
    });
    warn.mockRestore();
  });
});
