// Send to Knowledge Base's door (liveworkspace/docs/specs/004-index/blueprints/send-to-knowledge.md "liveknowledge"):
// a section is written, or a page's headings read, only on the person's own Editor grant for this knowledgebase,
// checked here before liveknowledge's handler sees it.
import type { GrantClaims } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationDoorGrants } from './automation-step-door';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { KNOWLEDGE_SEND_DOOR_BYTES_MAX } from './knowledge-send-door';

afterEach(() => vi.restoreAllMocks());

const CLAIMS = {
  iss: 'https://liveworkspace.app/api/index',
  aud: 'liveknowledge',
  sub: 'user_ada',
  item: 'K',
  level: 'edit',
  tab: null,
  team: null,
  iat: 1,
  exp: 2,
} as GrantClaims;

const CALL = {
  op: 'write',
  person: 'user_ada',
  place: { page: 'p1' },
  heading: 'Checkout',
  markdown: 'The cart sends the order to payment.',
  sentFrom: {
    app: 'livediagram',
    title: 'Payments',
    link: 'https://www.livediagram.app/document/D#t=t&el=e',
  },
};

const grants =
  (claims: GrantClaims | null): AutomationDoorGrants =>
  async (grant, itemId) =>
    grant === 'g' && itemId === 'K' ? claims : null;

const send = (
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  verifyGrant: AutomationDoorGrants | null = grants(CLAIMS),
  grant: string | null = 'g',
) =>
  handleInternalItems(
    new Request('https://app.test/api/internal/items/K/knowledge-send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer k',
        'Content-Type': 'application/json',
        ...(grant ? { 'X-Index-Grant': grant } : {}),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    {
      key: 'k',
      handlers: { purge: async () => {}, ...handlers },
      ...(verifyGrant ? { verifyGrant } : {}),
    },
  );

describe('Send to Knowledge Base at the knowledgebase', () => {
  it("writes on the person's Editor grant and answers what the knowledgebase said", async () => {
    const knowledgeSend = vi.fn(async () => ({
      ok: true as const,
      page: { id: 'p1', title: 'Checkout' },
      link: 'https://www.liveknowledge.app/document/K#t=p1',
    }));
    const res = await send(CALL, { knowledgeSend });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, page: { id: 'p1' } });
    expect(knowledgeSend).toHaveBeenCalledWith('K', CALL, CLAIMS, 'g');
  });

  it('reads a page outline on the same grant', async () => {
    const knowledgeSend = vi.fn(async () => ({ ok: true as const, headings: [] }));
    const outline = { op: 'outline', person: 'user_ada', page: 'p1' };
    expect(await (await send(outline, { knowledgeSend })).json()).toEqual({
      ok: true,
      headings: [],
    });
    expect(knowledgeSend).toHaveBeenCalledWith('K', outline, CLAIMS, 'g');
  });

  it("refuses any grant short of the person's Editor one on the whole knowledgebase", async () => {
    const knowledgeSend = vi.fn();
    for (const claims of [
      null,
      { ...CLAIMS, sub: 'user_ben' },
      { ...CLAIMS, item: 'Q' },
      { ...CLAIMS, level: 'participate' },
      { ...CLAIMS, level: 'view' },
      { ...CLAIMS, tab: 't1' },
      { ...CLAIMS, trashed: true },
    ] as (GrantClaims | null)[])
      expect((await send(CALL, { knowledgeSend }, grants(claims))).status).toBe(403);
    expect((await send(CALL, { knowledgeSend }, grants(CLAIMS), 'forged')).status).toBe(403);
    expect((await send(CALL, { knowledgeSend }, grants(CLAIMS), null)).status).toBe(403);
    expect(knowledgeSend).not.toHaveBeenCalled();
  });

  it('answers 400 to a call it cannot read or one past its size, a failure when the handler throws, 404 elsewhere', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await send({ ...CALL, markdown: '' }, { knowledgeSend: vi.fn() })).status).toBe(400);
    expect((await send('{not json', { knowledgeSend: vi.fn() })).status).toBe(400);
    const huge = JSON.stringify({ ...CALL, heading: 'x'.repeat(KNOWLEDGE_SEND_DOOR_BYTES_MAX) });
    expect((await send(huge, { knowledgeSend: vi.fn() })).status).toBe(400);
    const knowledgeSend = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await (await send(CALL, { knowledgeSend })).json()).toEqual({
      ok: false,
      code: 'failed',
      reason: '',
    });
    expect((await send(CALL, {})).status).toBe(404);
    expect((await send(CALL, { knowledgeSend }, null)).status).toBe(404);
  });
});
