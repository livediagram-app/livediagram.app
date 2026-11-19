// The teams client's answers to New Team when accounts didn't answer in time (Work Tracker 1071): the account
// API's own 504 code, or the router's bare 504 for the same request, both read "may have been made".
import { describe, expect, it, vi } from 'vitest';
import { createTeamsHost, teamErrorMessage } from './teams';

const answering = (response: Response) =>
  createTeamsHost({ baseUrl: '/api/workspace/account', fetch: vi.fn(async () => response) });

describe('New Team with no answer in time', () => {
  it('reads the account API’s 504 code and the router’s bare 504 as unconfirmed', async () => {
    const coded = await answering(
      Response.json({ error: 'team_create_unconfirmed' }, { status: 504 }),
    ).create({ name: 'Ops' });
    const router = await answering(
      new Response('router: liveworkspace at https://x did not answer in time', { status: 504 }),
    ).create({ name: 'Ops' });
    expect(coded).toEqual({ ok: false, error: 'team_create_unconfirmed' });
    expect(router).toEqual({ ok: false, error: 'team_create_unconfirmed' });
  });

  it('keeps a bare 504 on any other change a plain failure, and a 503 too', async () => {
    const renamed = await answering(new Response('', { status: 504 })).update('t1', {
      name: 'Ops',
    });
    const created = await answering(new Response('', { status: 503 })).create({ name: 'Ops' });
    expect(renamed).toEqual({ ok: false, error: 'failed' });
    expect(created).toEqual({ ok: false, error: 'failed' });
  });

  it('words it as a check, never a retry', () => {
    expect(teamErrorMessage('team_create_unconfirmed')).toBe(
      'The team may have been made. Refresh to check.',
    );
    expect(teamErrorMessage('team_not_made')).toBe('No team was made. You can create it now.');
  });
});
