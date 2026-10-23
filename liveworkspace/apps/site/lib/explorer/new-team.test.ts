import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeTeam } from './new-team';
import { resetWorkspaceIdentity } from './token';

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`;

afterEach(() => {
  vi.unstubAllGlobals();
  resetWorkspaceIdentity();
});

describe('New Team from the Explorer', () => {
  it('makes the team through the account API, then renews the token', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url === '/api/account/teams')
          return Response.json({ id: 't9', name: 'Design', role: 'admin' });
        return Response.json({
          token: jwt({ sub: 'u1', teams: [{ id: 't9', name: 'Design' }] }),
          kind: 'account',
          sub: 'u1',
          expiresAt: Date.now() + 600_000,
        });
      }),
    );
    const made = await makeTeam('Design');
    expect(made?.team).toEqual({ id: 't9', name: 'Design' });
    expect(made?.identity).not.toBeNull();
    expect(calls[0]).toBe('POST /api/account/teams');
    expect(calls[1]).toMatch(/workspace-token/);
  });

  it('answers null when accounts refuse it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'name_required' }, { status: 400 })),
    );
    expect(await makeTeam('')).toBeNull();
  });
});
