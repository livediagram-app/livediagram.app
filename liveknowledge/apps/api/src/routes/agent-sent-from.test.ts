import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSourcesClient } from '@liveworkspace/index-client';
import { setKnowledgeSourcesClientForTests } from '../knowledge/source-work';
import { withAgentSentFrom } from './agent-sent-from';
import type { KnowledgeRoute } from './knowledge-routes';

// An agent's Send to Knowledge Base (docs/specs/013-workspace/send-to-knowledge.md "Agents"): `sentFrom` adds the
// Sent From line the index names, and the send is kept once the page is written.

afterEach(() => {
  setKnowledgeSourcesClientForTests(null);
  vi.restoreAllMocks();
});

const FROM = {
  app: 'livediagram' as const,
  title: 'Payments',
  link: 'https://www.livediagram.app/document/D',
};

const routeOf = (body: unknown, person: string | null = 'user_ana'): KnowledgeRoute =>
  ({
    ctx: {
      env: {},
      verifiedUserId: person,
      request: new Request('https://lk.test/api/documents/K/pages/p1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    },
    document: { id: 'K' },
  }) as unknown as KnowledgeRoute;

function index(answer: typeof FROM | null) {
  const agentSend = vi.fn(async () => answer);
  setKnowledgeSourcesClientForTests({ agentSend } as unknown as KnowledgeSourcesClient);
  return agentSend;
}

const page = () => ({ id: 'p1', title: 'Checkout' });
const sentBody = async (r: KnowledgeRoute) => r.ctx.request.json<Record<string, unknown>>();

describe('sentFrom on an agent write', () => {
  it('leaves a write without it as it was', async () => {
    const agentSend = index(FROM);
    const run = vi.fn(async (r: KnowledgeRoute) => Response.json(await sentBody(r)));
    const res = await withAgentSentFrom(routeOf({ markdown: 'Hi' }), page, run);
    expect(await res.json()).toEqual({ markdown: 'Hi' });
    expect(agentSend).not.toHaveBeenCalled();
  });

  it('adds the Sent From line and records the send once written', async () => {
    const agentSend = index(FROM);
    const run = vi.fn(async (r: KnowledgeRoute) => Response.json({ seen: await sentBody(r) }));
    const source = { app: 'livediagram', itemId: 'D', tabId: 't1', elementIds: ['e1'] };
    const res = await withAgentSentFrom(
      routeOf({ markdown: 'Words\n', mode: 'append', sentFrom: source }),
      page,
      run,
    );
    expect(await res.json()).toEqual({
      seen: {
        markdown: `Words\n\nSent from [Payments](${FROM.link}) in livediagram`,
        mode: 'append',
      },
      sentFrom: 'recorded',
    });
    expect(agentSend).toHaveBeenNthCalledWith(
      1,
      'K',
      expect.objectContaining({ person: 'user_ana', source: { ...source } }),
      false,
    );
    expect(agentSend).toHaveBeenNthCalledWith(
      2,
      'K',
      expect.objectContaining({ page: { id: 'p1', title: 'Checkout' } }),
      true,
    );
  });

  it('still writes when the index will not name the source, and says so', async () => {
    const agentSend = index(null);
    const run = vi.fn(async (r: KnowledgeRoute) => Response.json({ seen: await sentBody(r) }));
    const res = await withAgentSentFrom(
      routeOf({ markdown: 'Words', sentFrom: { app: 'livediagram', itemId: 'D' } }),
      page,
      run,
    );
    expect(await res.json()).toEqual({ seen: { markdown: 'Words' }, sentFrom: 'not recorded' });
    expect(agentSend).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the write is refused, and refuses a sentFrom it cannot read', async () => {
    const agentSend = index(FROM);
    const refused = await withAgentSentFrom(
      routeOf({ markdown: 'Words', sentFrom: { app: 'livediagram', itemId: 'D' } }),
      page,
      async () => Response.json({ error: 'page_verified' }, { status: 409 }),
    );
    expect(refused.status).toBe(409);
    expect(agentSend).toHaveBeenCalledTimes(1);
    const bad = await withAgentSentFrom(
      routeOf({ markdown: 'Words', sentFrom: { app: 'nowhere', itemId: 'D' } }),
      page,
      vi.fn(),
    );
    expect(bad.status).toBe(400);
  });
});
