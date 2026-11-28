// Whose access a chat request runs on (docs/specs/030-knowledgebase/chat-apps.md "Whose access an answer uses"): the
// index's grant for the linked person, asked as them with their current teams, and the room's own route with that
// grant and no bearer. The index, the accounts and the room are stood in for; every gate is the module's own.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentGrant } from '../index-service';
import type { Env } from '../types';

const mocks = vi.hoisted(() => ({
  currentTeams: vi.fn(),
  requestGrant: vi.fn(),
  verifyGrant: vi.fn(),
  documentGrantOf: vi.fn(),
  route: vi.fn(),
  roomFor: vi.fn(),
}));

vi.mock('@liveworkspace/index-app', async (original) => ({
  ...(await original<typeof import('@liveworkspace/index-app')>()),
  createTeamAccess: () => ({ currentTeams: mocks.currentTeams }),
  accountsTeamReader: () => ({}),
}));
vi.mock('../auth/accounts', () => ({ accountCredentials: () => ({}) }));
vi.mock('../index-service', () => ({
  requestGrant: mocks.requestGrant,
  indexService: { verifyGrant: mocks.verifyGrant },
  documentGrantOf: mocks.documentGrantOf,
}));
vi.mock('../document-client', () => ({
  documentRoom: (_env: unknown, id: string) => {
    mocks.roomFor(id);
    return { route: mocks.route };
  },
}));

import { callAsPerson, chatPersonDeps } from './chat-as-person';

const env = {} as Env;
const KB = 'kb-1';
const grantOf = (over: Partial<DocumentGrant> = {}) =>
  ({ item: KB, role: 'VIEW', scope: null, ...over }) as unknown as DocumentGrant;

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

/** The index answers this person with a grant on the knowledgebase. */
function indexGrants(grant: DocumentGrant | null, { trashed = false } = {}) {
  mocks.requestGrant.mockResolvedValue({ ok: true, grant: { grant: 'signed', trashed } });
  mocks.verifyGrant.mockResolvedValue(grant ? { sub: 'claims' } : null);
  mocks.documentGrantOf.mockReturnValue(grant);
}

describe('the grant a chat request runs on', () => {
  it('asks the index as the person, with their current teams, and reads the grant it signs', async () => {
    mocks.currentTeams.mockResolvedValue([{ id: 'team-a' }, { id: 'team-b' }]);
    const viewer = grantOf();
    indexGrants(viewer);
    expect(await chatPersonDeps.grantFor(env, KB, 'user_v')).toBe(viewer);
    expect(mocks.requestGrant).toHaveBeenCalledWith(
      env,
      { kind: 'delegate', personId: 'user_v', teams: ['team-a', 'team-b'] },
      KB,
      null,
    );
    expect(mocks.verifyGrant).toHaveBeenCalledWith(env, 'signed', KB);
    expect(mocks.documentGrantOf).toHaveBeenCalledWith({ sub: 'claims' }, null, 'signed');
  });

  it('asks with no teams when the accounts service cannot say, rather than failing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.currentTeams.mockRejectedValue(new Error('accounts down'));
    indexGrants(grantOf());
    expect(await chatPersonDeps.grantFor(env, KB, 'user_v')).not.toBeNull();
    expect(mocks.requestGrant.mock.calls[0]![1]).toEqual({
      kind: 'delegate',
      personId: 'user_v',
      teams: [],
    });
    expect(warn).toHaveBeenCalledWith('[chat] teams unread', expect.anything());
  });

  it('is none when the index grants the person nothing (access revoked, never shared)', async () => {
    mocks.currentTeams.mockResolvedValue([]);
    mocks.requestGrant.mockResolvedValue({ ok: false, status: 403 });
    expect(await chatPersonDeps.grantFor(env, KB, 'user_gone')).toBeNull();
    expect(mocks.verifyGrant).not.toHaveBeenCalled();
  });

  it('is none for a knowledgebase in the Trash', async () => {
    mocks.currentTeams.mockResolvedValue([]);
    indexGrants(grantOf(), { trashed: true });
    expect(await chatPersonDeps.grantFor(env, KB, 'user_v')).toBeNull();
    expect(mocks.verifyGrant).not.toHaveBeenCalled();
  });

  it('is none when the signed grant does not verify (a revoked or forged token)', async () => {
    mocks.currentTeams.mockResolvedValue([]);
    indexGrants(null);
    expect(await chatPersonDeps.grantFor(env, KB, 'user_v')).toBeNull();
    expect(mocks.documentGrantOf).not.toHaveBeenCalled();
  });
});

describe('the room a chat request reaches', () => {
  it("is the knowledgebase's own, as the person, with the grant and never a bearer or token", async () => {
    mocks.route.mockResolvedValue(new Response('ok'));
    const grant = grantOf();
    const request = new Request('https://chat.internal/x');
    await chatPersonDeps.route(env, KB, request, 'user_v', grant);
    expect(mocks.roomFor).toHaveBeenCalledWith(KB);
    expect(mocks.route).toHaveBeenCalledWith(request, {
      accountUserId: 'user_v',
      verifiedUserId: 'user_v',
      accountEmail: null,
      owner: 'user_v',
      token: null,
      workbench: null,
      teams: null,
      bearer: null,
      grant,
    });
  });
});

describe('callAsPerson', () => {
  const deps = (grant: DocumentGrant | null) => ({
    grantFor: vi.fn(async () => grant),
    route: vi.fn(async () => new Response('answered')),
  });

  it('refuses with no_access when the person has no grant, and never reaches the room', async () => {
    const d = deps(null);
    const res = await callAsPerson(env, d, {
      knowledgebase: KB,
      person: 'user_x',
      method: 'GET',
      path: '/api/documents/kb-1/pages/t',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'no_access' });
    expect(d.route).not.toHaveBeenCalled();
  });

  it("refuses a grant for another knowledgebase, so one item's access never opens another", async () => {
    const d = deps(grantOf({ item: 'kb-other' }));
    const res = await callAsPerson(env, d, {
      knowledgebase: KB,
      person: 'user_v',
      method: 'GET',
      path: '/api/documents/kb-1/pages/t',
    });
    expect(res.status).toBe(403);
    expect(d.route).not.toHaveBeenCalled();
  });

  it('posts a question as JSON to the room with the grant', async () => {
    const grant = grantOf();
    const d = deps(grant);
    const res = await callAsPerson(env, d, {
      knowledgebase: KB,
      person: 'user_v',
      method: 'POST',
      path: '/api/documents/kb-1/ask',
      body: { question: 'How do we deploy?' },
    });
    expect(await res.text()).toBe('answered');
    const [, kb, request, person, passed] = d.route.mock.calls[0] as unknown as [
      Env,
      string,
      Request,
      string,
      DocumentGrant,
    ];
    expect([kb, person, passed]).toEqual([KB, 'user_v', grant]);
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/api/documents/kb-1/ask');
    expect(request.headers.get('Content-Type')).toBe('application/json');
    expect(await request.json()).toEqual({ question: 'How do we deploy?' });
  });

  it('reads with no body', async () => {
    const d = deps(grantOf());
    await callAsPerson(env, d, {
      knowledgebase: KB,
      person: 'user_v',
      method: 'GET',
      path: '/api/documents/kb-1/pages/t?maxChars=1200',
    });
    const request = (d.route.mock.calls[0] as unknown as [Env, string, Request])[2];
    expect(request.method).toBe('GET');
    expect(request.body).toBeNull();
    expect(new URL(request.url).search).toBe('?maxChars=1200');
  });

  it('hands a grant confined to one page to the room unchanged, for its own gates to judge', async () => {
    const confined = grantOf({ scope: { tab: 't-1' } } as unknown as Partial<DocumentGrant>);
    const d = deps(confined);
    d.route.mockResolvedValue(Response.json({ error: 'forbidden' }, { status: 403 }));
    const res = await callAsPerson(env, d, {
      knowledgebase: KB,
      person: 'user_page',
      method: 'POST',
      path: '/api/documents/kb-1/ask',
      body: { question: 'q' },
    });
    expect(res.status).toBe(403);
    expect((d.route.mock.calls[0] as unknown as unknown[])[4]).toBe(confined);
  });
});
