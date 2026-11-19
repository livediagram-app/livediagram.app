import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailIntakeGateFor, emailIntakeScopeFor } from './email-intake-gate';

// docs/specs/026-plan/email-to-board.md "Who may manage an address" and "Managing an address": who gets the row, and
// the dialog's four calls, an Editor link's code riding along.
const core = vi.hoisted(() => ({
  API_BASE: 'https://api.test/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response): Promise<unknown> => (await res.json()) as unknown),
  expectOkVoid: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api/core', () => core);

const { newEmailIntakeAddress, readEmailIntakes, saveEmailIntake, turnOffEmailIntake } =
  await import('./email-intake-client');

const SCOPE = { ownerId: 'u1', projectId: 'p 1', shareCode: 'code1' };
afterEach(() => vi.clearAllMocks());

describe('email intake gate', () => {
  const base = {
    level: 'edit' as const,
    signedIn: true,
    authLoaded: true,
    hydrated: true,
    embed: false,
    workbench: false,
    offline: false,
    scope: { ownerId: 'u1', projectId: 'p1', shareCode: null, tabId: null },
  };

  it('opens for an Editor of the whole plan, a link carrying its code', () => {
    expect(emailIntakeScopeFor(base)).toEqual({ ownerId: 'u1', projectId: 'p1', shareCode: null });
    expect(
      emailIntakeScopeFor({ ...base, scope: { ...base.scope, shareCode: 'c' } })?.shareCode,
    ).toBe('c');
  });

  it('opens only for someone signed in; a guest meets Sign In, then Offline meets Sync Plan', () => {
    expect(emailIntakeScopeFor({ ...base, signedIn: false })).toBeNull();
    expect(emailIntakeGateFor(base)).toBeNull();
    expect(emailIntakeGateFor({ ...base, signedIn: false })).toBe('sign_in');
    expect(emailIntakeGateFor({ ...base, signedIn: false, authLoaded: false })).toBeNull();
    expect(emailIntakeGateFor({ ...base, offline: true, scope: null })).toBe('sync');
    expect(emailIntakeGateFor({ ...base, offline: true, scope: null, signedIn: false })).toBe(
      'sign_in',
    );
    expect(emailIntakeGateFor({ ...base, signedIn: false, level: 'view' })).toBeNull();
    expect(emailIntakeGateFor({ ...base, signedIn: false, embed: true })).toBeNull();
  });

  it('draws no row for a Participant, a Viewer, a tab link, Offline, an embed or a workbench', () => {
    for (const input of [
      { ...base, level: 'participate' as const },
      { ...base, level: 'view' as const },
      { ...base, scope: { ...base.scope, tabId: 't1' } },
      { ...base, offline: true },
      { ...base, embed: true },
      { ...base, workbench: true },
      { ...base, hydrated: false },
      { ...base, scope: null },
    ])
      expect(emailIntakeScopeFor(input)).toBeNull();
  });
});

describe('email intake client', () => {
  it('reads, saves, re-addresses and turns off with the share code', async () => {
    core.apiFetch.mockResolvedValue(new Response('{"intakes":[]}'));
    await readEmailIntakes(SCOPE);
    expect(core.apiFetch).toHaveBeenLastCalledWith(
      'https://api.test/api/projects/p%201/email-intake',
      { method: 'GET', headers: { Authorization: 'Bearer t' } },
    );
    expect(core.apiHeaders).toHaveBeenLastCalledWith('u1', { share: 'code1', body: false });
    core.apiFetch.mockResolvedValue(new Response('{"intake":{}}'));
    await saveEmailIntake(SCOPE, 'b/1', 'anyone');
    expect(core.apiFetch).toHaveBeenLastCalledWith(
      'https://api.test/api/projects/p%201/email-intake/b%2F1',
      { method: 'PUT', headers: { Authorization: 'Bearer t' }, body: '{"senders":"anyone"}' },
    );
    core.apiFetch.mockResolvedValue(new Response('{"intake":{}}'));
    await newEmailIntakeAddress(SCOPE, 'b1');
    expect(core.apiFetch.mock.lastCall![0]).toBe(
      'https://api.test/api/projects/p%201/email-intake/b1/new-address',
    );
    expect(core.apiFetch.mock.lastCall![1]).toMatchObject({ method: 'POST' });
    core.apiFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await turnOffEmailIntake(SCOPE, 'b1');
    expect(core.apiFetch.mock.lastCall![1]).toMatchObject({ method: 'DELETE' });
  });
});
