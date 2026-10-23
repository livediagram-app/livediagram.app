import { beforeEach, describe, expect, it, vi } from 'vitest';

// A workspace session at the front door (docs/specs/013-workspace/blueprints/workbench-embeds.md "The choke point
// by scope"): every route class the Explorer uses reaches its route as the person, and every account class is
// refused before any route runs. Each route module is a stub that answers 204, so reaching it is the proof.
vi.mock('./auth/accounts', () => ({ getAccountIdentity: async () => null }));
vi.mock('./db', () => ({ resolveApiToken: vi.fn() }));

// One stub per route module the dispatch names: it records the context it was handed and answers 204.
const { resolveWorkbenchSessionMock, reached, stub } = vi.hoisted(() => {
  const reached = vi.fn();
  return {
    resolveWorkbenchSessionMock: vi.fn(),
    reached,
    stub: (name: string) => ({
      [name]: async (ctx: unknown) => {
        reached(name, ctx);
        return new Response(null, { status: 204 });
      },
    }),
  };
});
vi.mock('./auth/workbench-session', async (original) => ({
  ...(await original<typeof import('./auth/workbench-session')>()),
  resolveWorkbenchSession: resolveWorkbenchSessionMock,
}));

vi.mock('./routes/account', () => stub('handleAccount'));
vi.mock('./routes/ai', () => stub('handleAi'));
vi.mock('./routes/catalogues', () => stub('handleCatalogues'));
vi.mock('./routes/capabilities', () => stub('handleCapabilities'));
vi.mock('./routes/custom-themes', () => stub('handleCustomThemes'));
vi.mock('./routes/designs', () => stub('handleDesigns'));
vi.mock('./routes/folders', () => stub('handleFolders'));
vi.mock('./routes/forms', () => stub('handleForms'));
vi.mock('./routes/images', () => stub('handleImages'));
vi.mock('./routes/migrate', () => stub('handleMigrate'));
vi.mock('./routes/guest-id', () => stub('handleGuestId'));
vi.mock('./routes/participants', () => stub('handleParticipants'));
vi.mock('./routes/favourites', () => stub('handleFavourites'));
vi.mock('./routes/tags', () => stub('handleTags'));
vi.mock('./routes/placement-defaults', () => stub('handlePlacementDefaults'));
vi.mock('./routes/timeline', () => stub('handleTimeline'));
vi.mock('./routes/activity', () => stub('handleActivity'));
vi.mock('./routes/home', () => stub('handleHome'));
vi.mock('./routes/preferences', () => stub('handlePreferences'));
vi.mock('./routes/share', () => stub('handleShare'));
vi.mock('./routes/teams', () => stub('handleTeams'));
vi.mock('./routes/shared', () => stub('handleShared'));
vi.mock('./routes/trash', () => stub('handleTrash'));
vi.mock('./routes/tokens', () => stub('handleTokens'));
vi.mock('./routes/oauth', () => stub('handleOauthExchange'));
vi.mock('./routes/workbench', () => stub('handleWorkbench'));

import worker from './index';
import type { RouteContext, WorkbenchContext } from './routes/context';
import type { Env } from './types';

const LVW = `lvw_${'w'.repeat(43)}`;
const SESSION: WorkbenchContext = {
  sessionId: 'abcdef12-0000-4000-8000-000000000000',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  scope: 'workspace',
  designId: null,
  folderId: null,
  tabId: null,
  origin: 'https://w.example',
  level: 'edit',
  expiresAt: 1,
};

const call = (method: string, path: string, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`https://api.test/api/${path}`, {
      method,
      headers: { Authorization: `Bearer ${LVW}`, ...headers },
    }),
    {} as unknown as Env,
  );

describe('a workspace session at the front door', () => {
  beforeEach(() => {
    reached.mockClear();
    resolveWorkbenchSessionMock.mockReset();
    resolveWorkbenchSessionMock.mockResolvedValue({ ok: true, workbench: SESSION });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each([
    ['GET', 'capabilities', 'handleCapabilities'],
    ['GET', 'templates/kanban', 'handleCatalogues'],
    ['GET', 'preferences', 'handlePreferences'],
    ['GET', 'participants/user_1', 'handleParticipants'],
    ['GET', 'share/CODE2345', 'handleShare'],
    ['GET', 'designs', 'handleDesigns'],
    ['POST', 'designs', 'handleDesigns'],
    ['GET', 'designs/any-doc', 'handleDesigns'],
    ['PUT', 'designs/any-doc/tabs/t1', 'handleDesigns'],
    ['PUT', 'designs/any-doc/folder', 'handleDesigns'],
    ['POST', 'designs/any-doc/copy', 'handleDesigns'],
    ['POST', 'designs/any-doc/share', 'handleDesigns'],
    ['DELETE', 'designs/any-doc', 'handleDesigns'],
    ['POST', 'designs/any-doc/room-ticket', 'handleDesigns'],
    ['GET', 'folders', 'handleFolders'],
    ['POST', 'folders', 'handleFolders'],
    ['DELETE', 'folders/f1', 'handleFolders'],
    ['GET', 'shared', 'handleShared'],
    ['PUT', 'favourites/doc1', 'handleFavourites'],
    ['GET', 'tags', 'handleTags'],
    ['GET', 'home', 'handleHome'],
    ['GET', 'timeline', 'handleTimeline'],
    ['GET', 'activity', 'handleActivity'],
    ['GET', 'trash', 'handleTrash'],
    ['POST', 'trash/doc1/restore', 'handleTrash'],
    ['GET', 'placement-defaults', 'handlePlacementDefaults'],
    ['GET', 'images', 'handleImages'],
    ['POST', 'images', 'handleImages'],
    ['POST', 'custom-themes', 'handleCustomThemes'],
    ['GET', 'teams', 'handleTeams'],
    ['GET', 'teams/team1/library', 'handleTeams'],
    ['DELETE', 'workbench/sessions/current', 'handleWorkbench'],
  ])('lets %s %s reach its route as the person', async (method, path, handler) => {
    const res = await call(method, path);

    expect(res.status).toBe(204);
    expect(reached).toHaveBeenCalledWith(handler, expect.anything());
    const ctx = reached.mock.calls[0]![1] as RouteContext;
    expect(ctx.workbench).toEqual(SESSION);
    expect(ctx.accountUserId).toBeNull();
    expect(ctx.token).toBeNull();
    expect(ctx.resolveOwner()).toBe('user_1');
    expect(ctx.verifiedUserId).toBe('user_1');
  });

  it.each([
    ['GET', 'account'],
    ['DELETE', 'account'],
    ['POST', 'migrate'],
    ['POST', 'guest-id'],
    ['GET', 'tokens'],
    ['POST', 'tokens'],
    ['DELETE', 'tokens/current'],
    ['GET', 'workbench/pairings'],
    ['DELETE', 'workbench/pairings/p1'],
    ['POST', 'workbench/tickets'],
    ['PUT', 'preferences'],
    ['PUT', 'participants/user_1'],
    ['GET', 'participants/user_2'],
    ['POST', 'ai'],
    ['POST', 'oauth'],
    ['POST', 'teams'],
    ['GET', 'teams/invites'],
    ['POST', 'teams/team1/members'],
    ['DELETE', 'teams/team1/members/user_2'],
    ['GET', 'teams/team1/invite-link'],
    ['PUT', 'designs/any-doc/tabs/t1/presence'],
    ['GET', 'forms/abc'],
  ])('refuses %s %s as workbench_confined before any route runs', async (method, path) => {
    const res = await call(method, path);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'workbench_confined' });
    expect(reached).not.toHaveBeenCalled();
  });

  it('refuses the guest header but lets a share link reach the route', async () => {
    const guest = await call('GET', 'designs/any-doc', { 'X-Owner-Id': 'guest-1' });
    const link = await call('GET', 'designs/any-doc', { 'X-Share-Code': 'CODE2345' });

    expect(guest.status).toBe(403);
    expect(link.status).toBe(204);
  });

  it('keeps a view session to browsing and reading', async () => {
    resolveWorkbenchSessionMock.mockResolvedValue({
      ok: true,
      workbench: { ...SESSION, level: 'view' },
    });

    const write = await call('POST', 'folders');
    const list = await call('GET', 'designs/any-doc/share');
    const read = await call('GET', 'designs');

    expect([write.status, list.status, read.status]).toEqual([403, 403, 204]);
    expect(await write.json()).toEqual({ error: 'workbench_read_only' });
  });
});
