import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { sqliteD1 } from '../test-sqlite-d1';

// What the index was asked: the sign-in rules set and the links made, in order.
const { asked, refuseRule } = vi.hoisted(() => ({
  asked: [] as unknown[],
  refuseRule: { error: null as IndexError | null },
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    setShareSignIn: async (id: string, rule: unknown) => {
      asked.push(['rule', id, rule]);
      if (refuseRule.error) throw refuseRule.error;
      return { signIn: rule };
    },
    createShareLink: async (id: string, input: { level?: string } = {}) => {
      asked.push(['link', id, input]);
      return {
        link: {
          code: 'ABCDEFGHJKLMNP',
          itemId: id,
          level: input.level ?? 'edit',
          tabId: null,
          expiry: 'never',
          expiresAt: null,
          createdAt: 1,
        },
      };
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocumentIndexRoutes } from './document-index-routes';

// The MCP's share_document and the CLI's `document share` (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "Sharing and access"): Require Sign In and email domains set the document's one rule
// before the link is made, and a share naming neither leaves the rule alone.
const share = async (body: unknown) =>
  (await handleDocumentIndexRoutes(
    makeTestRouteContext('POST', '/api/documents/D/share', {
      env: sqliteD1().env,
      owner: 'owner',
      body,
    }),
  ))!;

beforeEach(() => {
  asked.length = 0;
  refuseRule.error = null;
});

describe('POST /api/documents/:id/share sign-in', () => {
  it('makes a link as today when the body names no rule', async () => {
    const res = await share({ role: 'view' });
    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty('signIn');
    expect(asked).toEqual([['link', 'D', { level: 'view' }]]);
  });

  it('sets Require Sign In, then makes the link, answering the rule', async () => {
    const res = await share({ role: 'participate', requireSignIn: true });
    expect(res.status).toBe(201);
    expect((await res.json<{ signIn: unknown }>()).signIn).toEqual({
      requireAccount: true,
      domains: [],
    });
    expect(asked).toEqual([
      ['rule', 'D', { requireAccount: true, domains: [] }],
      ['link', 'D', { level: 'participate' }],
    ]);
  });

  it('normalises domains, which imply sign-in', async () => {
    await share({ domains: ['@Acme.com', 'b.org'] });
    expect(asked[0]).toEqual([
      'rule',
      'D',
      { requireAccount: true, domains: ['acme.com', 'b.org'] },
    ]);
  });

  it('refuses a bad rule before asking the index anything', async () => {
    const res = await share({ domains: 'nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_domain', domain: 'nope' });
    expect(asked).toEqual([]);
  });

  it("relays the index's refusal of the rule, making no link", async () => {
    refuseRule.error = new IndexError(404, 'not_found');
    const res = await share({ requireSignIn: true });
    expect(res.status).toBe(404);
    expect(asked).toHaveLength(1);
  });
});
