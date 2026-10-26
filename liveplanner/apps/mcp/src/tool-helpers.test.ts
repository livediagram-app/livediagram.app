import { describe, expect, it } from 'vitest';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { deepLink, loadTab, shareUrl } from './tool-helpers';

// This product's links and tab loading. The result shapes and the token guard every product's tools share are
// tested in @liveworkspace/mcp-kit (tool-result.test.ts).

describe('deepLink', () => {
  it('points at the project route on the production host', () => {
    expect(deepLink({}, 'abc-123')).toBe('https://liveplanner.app/project/abc-123');
  });

  it("points at this server's own app on staging or another deployment", () => {
    const staging = { CONSENT_BASE_URL: 'https://staging.liveplanner.app' };
    expect(deepLink(staging, 'abc')).toBe('https://staging.liveplanner.app/project/abc');
    expect(shareUrl(staging, 'AB')).toBe('https://staging.liveplanner.app/project/shared?s=AB');
  });
});

describe('shareUrl', () => {
  it('points at the shared route with the code as a query param', () => {
    expect(shareUrl({}, 'AB12CD')).toBe('https://liveplanner.app/project/shared?s=AB12CD');
  });

  it('escapes the code rather than pasting it into the query raw', () => {
    // Share codes are minted server-side, so this is defence rather than a
    // live bug — but the value lands in a URL a model may hand to a user, and
    // an unescaped `&` would silently truncate the code.
    expect(shareUrl({}, 'a&b=c')).toBe('https://liveplanner.app/project/shared?s=a%26b%3Dc');
    expect(shareUrl({}, 'a b')).toBe('https://liveplanner.app/project/shared?s=a%20b');
  });
});

describe('loadTab', () => {
  // An api double that answers the project and tab reads, recording the paths
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
            tab ? { tab: { id: tab, name: tab, elements: [] } } : { project: { id: 'd1', tabs } },
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
    expect(paths).toEqual(['/api/projects/d1', '/api/projects/d1/tabs/t1']);
  });

  it('loads the named tab', async () => {
    const { env, paths } = apiEnv([{ id: 't1' }, { id: 't2' }]);
    const loaded = await loadTab(env, 'tok', 'd1', 't2');
    expect(loaded?.project.id).toBe('d1');
    expect(loaded?.tab.id).toBe('t2');
    expect(paths.at(-1)).toBe('/api/projects/d1/tabs/t2');
  });

  it('is null for a project with no tabs, without a tab read', async () => {
    const { env, paths } = apiEnv([]);
    expect(await loadTab(env, 'tok', 'd1')).toBeNull();
    expect(paths).toEqual(['/api/projects/d1']);
  });
});
