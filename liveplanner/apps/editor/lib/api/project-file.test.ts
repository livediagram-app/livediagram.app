// The plan's .liveplanner file from the editor (docs/specs/015-api/api.md `GET` / `POST /api/projects/:id/file`): the
// export reads the file's text; the import makes the index's item first, writes the file with its grant, and takes
// the item away again when the write fails, so nobody finds an empty plan.
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createItem, deleteItem, fetchMock, seed } = vi.hoisted(() => ({
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  fetchMock: vi.fn(),
  seed: vi.fn(),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { createItem, deleteItem },
}));
vi.mock('./plan-grants', () => ({ seedPlanGrant: seed }));
vi.mock('./core', async (original) => ({
  ...(await original<typeof import('./core')>()),
  apiFetch: fetchMock,
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
}));

import { ApiError } from './core';
import { apiExportProjectFile, apiImportProjectFile } from './project-file';

const GRANT = { grant: 'signed-grant', level: 'edit' };

afterEach(() => vi.clearAllMocks());

describe('apiExportProjectFile', () => {
  it('answers the file’s text', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"kind":"liveplanner.project"}'));
    expect(await apiExportProjectFile('me', 'P1')).toBe('{"kind":"liveplanner.project"}');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/projects/P1/file');
  });

  it('throws ApiError on a refusal', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));
    await expect(apiExportProjectFile('me', 'P1')).rejects.toMatchObject({ status: 403 });
  });
});

describe('apiImportProjectFile', () => {
  it('makes the index’s item as an import, then posts the file with its grant', async () => {
    createItem.mockResolvedValueOnce({ item: { title: 'Roadmap' }, grant: GRANT });
    fetchMock.mockResolvedValueOnce(Response.json({ project: {} }, { status: 201 }));
    const id = await apiImportProjectFile('me', 'FILE', 'Roadmap');
    expect(createItem).toHaveBeenCalledWith({
      id,
      app: 'liveplanner',
      title: 'Roadmap',
      source: 'import',
    });
    expect(seed).toHaveBeenCalledWith(id, GRANT);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/projects/${id}/file`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('FILE');
    expect((init.headers as Record<string, string>)['X-Index-Grant']).toBe('signed-grant');
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('takes the item away for good when the write is refused, and throws the api’s code', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createItem.mockResolvedValueOnce({ item: { title: 'R' }, grant: GRANT });
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'invalid_file' }, { status: 400 }));
    deleteItem.mockRejectedValueOnce(new Error('offline'));
    const err = await apiImportProjectFile('me', 'BAD', 'R').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('invalid_file');
    expect(deleteItem).toHaveBeenCalledWith(expect.any(String), { permanent: true });
  });
});
