import { describe, expect, it } from 'vitest';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { deepLink, loadTab, shareUrl } from './tool-helpers';

// This product's links and tab loading. The result shapes and the token guard every product's tools share are
// tested in @liveworkspace/mcp-kit (tool-result.test.ts).

describe('deepLink', () => {
  it('points at the document route on the production host', () => {
    expect(deepLink({}, 'abc-123')).toBe('https://livedocuments.app/document/abc-123');
  });

  it("points at this server's own app on staging", () => {
    const staging = { CONSENT_BASE_URL: 'https://staging.livedocuments.app' };
    expect(deepLink(staging, 'abc')).toBe('https://staging.livedocuments.app/document/abc');
    expect(shareUrl(staging, 'AB')).toBe('https://staging.livedocuments.app/document/shared?s=AB');
  });
});

describe('shareUrl', () => {
  it('points at the shared route with the code as a query param', () => {
    expect(shareUrl({}, 'AB12CD')).toBe('https://livedocuments.app/document/shared?s=AB12CD');
  });

  it('escapes the code rather than pasting it into the query raw', () => {
    // Share codes are minted server-side, so this is defence rather than a
    // live bug — but the value lands in a URL a model may hand to a user, and
    // an unescaped `&` would silently truncate the code.
    expect(shareUrl({}, 'a&b=c')).toBe('https://livedocuments.app/document/shared?s=a%26b%3Dc');
    expect(shareUrl({}, 'a b')).toBe('https://livedocuments.app/document/shared?s=a%20b');
  });
});

describe('loadTab', () => {
  // An api double that answers the document and tab reads, recording the paths
  // it was asked for so each case can see which tab was fetched.
  function apiEnv(tabs: Array<{ id: string }>) {
    const paths: string[] = [];
    const env = {
      API: {
        fetch: async (req: Request) => {
          const path = new URL(req.url).pathname;
          paths.push(path);
          const tab = path.match(/\/tabs\/([^/]+)$/)?.[1];
          return Response.json(
            tab ? { tab: { id: tab, name: tab, elements: [] } } : { document: { id: 'd1', tabs } },
          );
        },
      },
    } as unknown as Env;
    return { env, paths };
  }

  it('defaults to the first tab when none is named', async () => {
    const { env, paths } = apiEnv([{ id: 't1' }, { id: 't2' }]);
    const loaded = await loadTab(env, 'tok', 'd1');
    expect(loaded?.tab.id).toBe('t1');
    expect(paths).toEqual(['/api/documents/d1', '/api/documents/d1/tabs/t1']);
  });

  it('loads the named tab', async () => {
    const { env, paths } = apiEnv([{ id: 't1' }, { id: 't2' }]);
    const loaded = await loadTab(env, 'tok', 'd1', 't2');
    expect(loaded?.document.id).toBe('d1');
    expect(loaded?.tab.id).toBe('t2');
    expect(paths.at(-1)).toBe('/api/documents/d1/tabs/t2');
  });

  it('is null for a document with no tabs, without a tab read', async () => {
    const { env, paths } = apiEnv([]);
    expect(await loadTab(env, 'tok', 'd1')).toBeNull();
    expect(paths).toEqual(['/api/documents/d1']);
  });
});
