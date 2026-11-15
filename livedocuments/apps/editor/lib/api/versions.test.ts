import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiCopyVersion,
  apiListVersions,
  apiNameCurrentVersion,
  apiReadVersion,
  apiRenameVersion,
  apiRestoreVersion,
} from './versions';

// The Version History panel's api calls (docs/specs/006-document/version-history.md "API").

type Call = { url: string; init: RequestInit };

function stub(answer: unknown, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(Response.json(answer, { status }));
    }),
  );
  return calls;
}

const who = { ownerId: 'owner-1', shareCode: null };
const base = /\/documents\/d1\/tabs\/t1\/versions/;

afterEach(() => vi.unstubAllGlobals());

describe('the version calls', () => {
  it('lists and reads', async () => {
    const calls = stub({ versions: [{ id: 'v1' }] });
    expect((await apiListVersions(who, 'd1', 't1')).map((v) => v.id)).toEqual(['v1']);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/tabs\/t1\/versions$/);
    stub({ version: { id: 'v1' }, tab: { id: 't1' } });
    expect((await apiReadVersion(who, 'd1', 't1', 'v1')).tab.id).toBe('t1');
  });

  it('names, renames and unnames with a JSON body', async () => {
    const calls = stub({ version: { id: 'v1', name: 'Draft' } });
    expect((await apiNameCurrentVersion(who, 'd1', 't1', 'Draft')).name).toBe('Draft');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ name: 'Draft' });
    await apiRenameVersion(who, 'd1', 't1', 'v1', null);
    expect(calls[1]!.url).toMatch(/versions\/v1\/name$/);
    expect(calls[1]!.init.method).toBe('PUT');
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ name: null });
  });

  it('restores and copies as the editor', async () => {
    const restored = { tabId: 't1', rev: 4, changesetId: 'cs_1', undoVersionId: 'v2' };
    const calls = stub({ restored });
    expect(await apiRestoreVersion(who, 'd1', 't1', 'v1')).toEqual(restored);
    expect(calls[0]!.url).toMatch(/versions\/v1\/restore$/);
    expect(new Headers(calls[0]!.init.headers).get('X-Livedocuments-Client')).toBe('editor');
    stub({ tab: { id: 'tN', name: 'Pitch (14 Nov)', rev: 1 } });
    expect((await apiCopyVersion(who, 'd1', 't1', 'v1', 'Pitch (14 Nov)')).id).toBe('tN');
  });

  it('throws a refusal with its code', async () => {
    stub({ error: 'too_many_names' }, 409);
    await expect(apiNameCurrentVersion(who, 'd1', 't1', 'X')).rejects.toMatchObject({
      status: 409,
      code: 'too_many_names',
    });
    expect(base.test('/documents/d1/tabs/t1/versions')).toBe(true);
  });
});
