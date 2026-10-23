import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import type { DesignGrant } from '../index-service';
import type { RouteContext, WorkbenchContext } from './context';
import {
  deniedOnTab,
  deniedParticipate,
  gateEdit,
  gateGrant,
  gateParticipate,
  gateRead,
  grantCallerOf,
  ownsDesign,
  requireOwner,
  shareAccessOf,
} from './context';

// The gates in routes/context.ts: who may do what to a design is the index's grant
// (liveworkspace/docs/one-explorer-contracts.md "Grants"), read here. Levels form a ladder (view < participate
// < edit), a tab-scoped grant reaches its own tab only, a grant for another design reaches nothing, and a workbench
// session holds no more than its own level.

const grant = (over: Partial<DesignGrant> = {}): DesignGrant => ({
  item: 'd1',
  level: 'edit',
  tab: null,
  sub: 'user_a',
  team: null,
  exp: 2_000_000_000,
  shareCode: null,
  token: 'g',
  ...over,
});

function makeCtx(
  opts: {
    owner?: string | null;
    headers?: Record<string, string>;
    grant?: DesignGrant | null;
    token?: { id: string } | null;
    workbench?: Partial<WorkbenchContext> | null;
    verifiedUserId?: string | null;
    bearer?: string | null;
  } = {},
): RouteContext {
  const owner = opts.owner === undefined ? 'user_a' : opts.owner;
  const url = new URL('https://api.test/api/designs/d1');
  const request = new Request(url, { headers: opts.headers ?? {} });
  return {
    request,
    env: {} as Env,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    accountUserId: null,
    verifiedUserId: opts.verifiedUserId ?? null,
    accountEmail: null,
    resolveOwner: () => owner,
    token: opts.token ?? null,
    workbench: (opts.workbench as WorkbenchContext | null) ?? null,
    teams: [{ id: 'team_1', name: 'T', role: 'member' }],
    bearer: opts.bearer ?? null,
    grant: opts.grant === undefined ? grant() : opts.grant,
  };
}

describe('the grant gates', () => {
  it('climb the ladder: each level holds everything below it', async () => {
    const view = makeCtx({ grant: grant({ level: 'view' }) });
    expect(await gateRead(view, 'd1')).toBe(true);
    expect(await gateParticipate(view, 'd1')).toBe(false);
    expect(await gateEdit(view, 'd1')).toBe(false);
    const part = makeCtx({ grant: grant({ level: 'participate' }) });
    expect(await gateParticipate(part, 'd1')).toBe(true);
    expect(await gateEdit(part, 'd1')).toBe(false);
    expect(await gateEdit(makeCtx(), 'd1')).toBe(true);
  });

  it('refuse without a grant, or with one for another design', async () => {
    expect(await gateRead(makeCtx({ grant: null }), 'd1')).toBe(false);
    expect(await gateRead(makeCtx({ grant: grant({ item: 'd2' }) }), 'd1')).toBe(false);
    expect(await gateGrant(makeCtx({ grant: grant({ item: 'd2' }) }), 'd1')).toBeNull();
  });

  it('confine a tab-scoped grant to its tab, and to no design-level door', async () => {
    const scoped = makeCtx({ grant: grant({ tab: 't1' }) });
    expect(await gateEdit(scoped, 'd1', undefined, undefined, 't1')).toBe(true);
    expect(await gateEdit(scoped, 'd1', undefined, undefined, 't2')).toBe(false);
    expect(await gateRead(scoped, 'd1')).toBe(false);
    expect(await gateGrant(scoped, 'd1')).toEqual({ role: 'edit', tabScope: 't1', shareCode: null });
  });

  it("cap a workbench session's grant at its own level", async () => {
    const ctx = makeCtx({ workbench: { level: 'view' } });
    expect(await gateRead(ctx, 'd1')).toBe(true);
    expect(await gateEdit(ctx, 'd1')).toBe(false);
  });

  it('carry the share code a link grant came by', async () => {
    const ctx = makeCtx({ grant: grant({ sub: 'link:CODE', shareCode: 'CODE', level: 'view' }) });
    expect((await gateGrant(ctx, 'd1'))?.shareCode).toBe('CODE');
  });
});

describe('the refusals', () => {
  const doc = { id: 'd1', ownerId: 'user_a', teamId: null };

  it('answer a grant scoped to another tab as missing, anything else as forbidden', async () => {
    expect((await deniedOnTab(makeCtx({ grant: grant({ tab: 't1' }) }), doc)).status).toBe(404);
    expect((await deniedOnTab(makeCtx({ grant: null }), doc)).status).toBe(403);
    expect(
      (await deniedParticipate(makeCtx({ grant: grant({ tab: 't1' }) }), doc, 't2')).status,
    ).toBe(404);
    expect(
      (await deniedParticipate(makeCtx({ grant: grant({ level: 'view' }) }), doc)).status,
    ).toBe(403);
  });
});

describe('ownsDesign', () => {
  it('is the design’s owner holding a grant on it', async () => {
    expect(await ownsDesign(makeCtx(), { id: 'd1', ownerId: 'user_a' })).toBe(true);
    expect(await ownsDesign(makeCtx({ owner: 'user_b' }), { id: 'd1', ownerId: 'user_a' })).toBe(
      false,
    );
    expect(await ownsDesign(makeCtx({ grant: null }), { id: 'd1', ownerId: 'user_a' })).toBe(
      false,
    );
  });
});

describe('who the index is asked for', () => {
  it('is an API token’s account, with its teams, under this app’s key', () => {
    expect(grantCallerOf(makeCtx({ token: { id: 't' }, verifiedUserId: 'user_a' }))).toEqual({
      kind: 'delegate',
      personId: 'user_a',
      teams: ['team_1'],
    });
  });

  it('is a browser’s own bearer otherwise (none for a link visitor)', () => {
    expect(grantCallerOf(makeCtx({ bearer: 'tok' }))).toEqual({ kind: 'bearer', token: 'tok' });
    expect(grantCallerOf(makeCtx())).toEqual({ kind: 'bearer', token: null });
  });

  it('sends a link’s code and password on', () => {
    expect(shareAccessOf(makeCtx({ headers: { 'X-Share-Code': 'C' } }).request)).toEqual({
      code: 'C',
    });
    expect(
      shareAccessOf(
        makeCtx({ headers: { 'X-Share-Code': 'C', 'X-Share-Password': 'p' } }).request,
      ),
    ).toEqual({ code: 'C', password: 'p' });
    expect(shareAccessOf(makeCtx().request)).toBeNull();
  });
});

describe('requireOwner', () => {
  it('is the caller, or the 400 with none', () => {
    expect(requireOwner(makeCtx())).toBe('user_a');
    expect((requireOwner(makeCtx({ owner: null })) as Response).status).toBe(400);
  });
});
