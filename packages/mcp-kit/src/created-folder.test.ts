import { ApiError } from '@liveworkspace/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createdFolderLabel } from './created-folder';

const clientOf = (json: (path: string) => Promise<unknown>) => ({
  json: json as <T>(path: string) => Promise<T>,
});

afterEach(() => vi.restoreAllMocks());

describe('createdFolderLabel', () => {
  it('says My Work for an item at the root', async () => {
    const json = vi.fn();
    expect(await createdFolderLabel(clientOf(json), undefined, 'create_x')).toBe('My Work');
    expect(await createdFolderLabel(clientOf(json), { folderId: null }, 'create_x')).toBe(
      'My Work',
    );
    expect(json).not.toHaveBeenCalled();
  });

  it("names a personal folder from /folders and a team's from its library", async () => {
    const json = vi.fn(async () => ({ folders: [{ id: 'f1', name: 'Drafts' }] }));
    expect(await createdFolderLabel(clientOf(json), { folderId: 'f1' }, 'create_x')).toBe('Drafts');
    expect(json).toHaveBeenLastCalledWith('/folders');
    await createdFolderLabel(clientOf(json), { folderId: 'f1', teamId: 't 1' }, 'create_x');
    expect(json).toHaveBeenLastCalledWith('/teams/t%201/library');
  });

  it('falls back to the default folder when the name is missing or the read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = clientOf(async () => ({}));
    expect(await createdFolderLabel(missing, { folderId: 'f1' }, 'create_x')).toBe(
      'your default folder',
    );
    expect(warn).toHaveBeenLastCalledWith('[mcp] create_x folder lookup failed status=missing');
    const refused = clientOf(async () => {
      throw new ApiError(403, '{"error":"forbidden"}');
    });
    await createdFolderLabel(refused, { folderId: 'f1' }, 'create_x');
    expect(warn).toHaveBeenLastCalledWith('[mcp] create_x folder lookup failed status=403');
    const offline = clientOf(async () => {
      throw new TypeError('fetch failed');
    });
    await createdFolderLabel(offline, { folderId: 'f1' }, 'create_x');
    expect(warn).toHaveBeenLastCalledWith('[mcp] create_x folder lookup failed status=network');
  });
});
