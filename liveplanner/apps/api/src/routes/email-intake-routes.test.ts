import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntakeResponse, EmailIntakesResponse } from '@liveplanner/api-schema';
import { defaultCatalogue } from '@liveplanner/items';
import { findIntake } from '../email-intake/intake-directory';
import { intakesOf } from '../email-intake/intake-store';
import {
  automationWorld,
  type AutomationWorld,
  type Caller,
} from '../plan-room/automations/test-automation-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import type { PlanEnv } from '../types';

// Who may manage a board's address (docs/specs/026-plan/email-to-board.md "Who may manage an address"; share-roles.md):
// an Editor of the whole plan, in person. A Participant, a Viewer, a link to one tab, an API token, a workbench session
// and a link visitor are refused on every route, see nothing of the address, and change nothing.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

const DOMAIN = 'in.liveplanner.test';
const ADDRESS = new RegExp(`^board\\+[a-z2-7]{26}@${DOMAIN.replace(/\./g, '\\.')}$`);
const codeOf = (address: string) => address.slice('board+'.length, address.indexOf('@'));

let w: AutomationWorld;
const planEnv = (): PlanEnv => w.plans.get('A')!.room.requireEnv();
// The worker's env and the room's copy of it.
const setDomain = (domain: string) => {
  Reflect.set(w.env, 'EMAIL_INTAKE_DOMAIN', domain);
  Reflect.set(planEnv(), 'EMAIL_INTAKE_DOMAIN', domain);
};
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await automationWorld('A');
  await setPlanItemTypes(planEnv(), 'A', defaultCatalogue());
  setDomain(DOMAIN);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const ALLOWED: Caller[] = ['owner', 'team', 'guest', 'editor_link'];
const REFUSED: Caller[] = [
  'tab_editor_link',
  'participant',
  'viewer',
  'token',
  'token_read_only',
  'token_tab',
  'workbench',
  'link_visitor',
];

const turnOn = async (who: Caller = 'owner', senders = 'members') => {
  const res = await w.as(who, 'PUT', '/email-intake/b1', { senders });
  expect(res.status).toBe(201);
  return (await res.json<EmailIntakeResponse>()).intake;
};

describe('an Editor of the whole plan', () => {
  it.each(ALLOWED)(
    '%s turns an address on, changes it, makes a new one and turns it off',
    async (who) => {
      const first = await w.as(who, 'GET', '/email-intake');
      expect(first.status).toBe(200);
      expect(first.headers.get('Cache-Control')).toBe('no-store');
      expect(await first.json<EmailIntakesResponse>()).toEqual({
        available: true,
        domain: DOMAIN,
        intakes: [],
        boards: [{ id: 'b1', title: 'Kanban', tabId: 't1', tabName: 'Board', column: 'Backlog' }],
      });

      const intake = await turnOn(who);
      expect(intake).toMatchObject({ boardId: 'b1', senders: 'members', made: 0, lastAt: null });
      expect(intake.address).toMatch(ADDRESS);
      expect(await findIntake(w.env, codeOf(intake.address))).toEqual({
        planId: 'A',
        boardId: 'b1',
      });

      const changed = await w.as(who, 'PUT', '/email-intake/b1', { senders: 'anyone' });
      expect(changed.status).toBe(200);
      expect((await changed.json<EmailIntakeResponse>()).intake).toMatchObject({
        address: intake.address,
        senders: 'anyone',
      });

      const rotated = await w.as(who, 'POST', '/email-intake/b1/new-address');
      expect(rotated.status).toBe(200);
      const next = (await rotated.json<EmailIntakeResponse>()).intake;
      expect(next.address).toMatch(ADDRESS);
      expect(next.address).not.toBe(intake.address);
      expect(next.senders).toBe('anyone');
      // The old address stops at once.
      expect(await findIntake(w.env, codeOf(intake.address))).toBeNull();
      expect(await findIntake(w.env, codeOf(next.address))).toEqual({ planId: 'A', boardId: 'b1' });

      const listed = await (await w.as(who, 'GET', '/email-intake')).json<EmailIntakesResponse>();
      expect(listed.intakes.map((i) => i.address)).toEqual([next.address]);

      expect((await w.as(who, 'DELETE', '/email-intake/b1')).status).toBe(204);
      expect(await findIntake(w.env, codeOf(next.address))).toBeNull();
      expect(await intakesOf(planEnv(), 'A')).toEqual([]);
      // Again: nothing to turn off.
      expect((await w.as(who, 'DELETE', '/email-intake/b1')).status).toBe(204);
    },
  );
});

describe('everyone else', () => {
  it.each(REFUSED)('%s is refused on every route and changes nothing', async (who) => {
    const intake = await turnOn();
    const calls: [string, string, unknown?][] = [
      ['GET', '/email-intake'],
      ['PUT', '/email-intake/b1', { senders: 'anyone' }],
      ['POST', '/email-intake/b1/new-address'],
      ['DELETE', '/email-intake/b1'],
    ];
    for (const [method, path, body] of calls) {
      const res = await w.as(who, method, path, body);
      expect([400, 401, 403]).toContain(res.status);
      const text = await res.text();
      expect(text).not.toContain(codeOf(intake.address));
      if (res.status === 403)
        expect(JSON.parse(text)).toEqual({ error: 'email_intake_needs_editor' });
    }
    const rows = await intakesOf(planEnv(), 'A');
    expect(rows.map((r) => [r.code, r.senders])).toEqual([[codeOf(intake.address), 'members']]);
  });
});

describe('refusals', () => {
  it('says unavailable without a domain, and lists nothing', async () => {
    setDomain('');
    const listed = await w.as('owner', 'GET', '/email-intake');
    expect(await listed.json()).toEqual({
      available: false,
      domain: null,
      intakes: [],
      boards: [],
    });
    const put = await w.as('owner', 'PUT', '/email-intake/b1', { senders: 'members' });
    expect(put.status).toBe(503);
    expect(await put.json()).toEqual({ error: 'email_intake_unavailable' });
  });

  it('refuses a bad body, an unknown board and a new address for none', async () => {
    for (const body of [{}, { senders: 'everyone' }])
      expect((await w.as('owner', 'PUT', '/email-intake/b1', body)).status).toBe(400);
    expect((await w.as('owner', 'PUT', '/email-intake/nope', { senders: 'members' })).status).toBe(
      400,
    );
    expect((await w.as('owner', 'PUT', `/email-intake/${'x'.repeat(201)}`, {})).status).toBe(400);
    const none = await w.as('owner', 'POST', '/email-intake/b1/new-address');
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: 'email_intake_not_found' });
  });

  it('answers 405 for another method and passes other paths by', async () => {
    expect((await w.as('owner', 'POST', '/email-intake')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/email-intake/b1')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/email-intake/b1/new-address')).status).toBe(405);
    expect((await w.as('owner', 'POST', '/email-intake/b1/other')).status).not.toBe(405);
  });

  it('stops listing an address whose board has gone', async () => {
    await turnOn();
    expect((await w.send('DELETE', '/api/projects/A/tabs/t1')).status).toBeLessThan(300);
    const listed = await (await w.as('owner', 'GET', '/email-intake')).json<EmailIntakesResponse>();
    expect(listed.intakes).toEqual([]);
    expect(listed.boards).toEqual([]);
  });
});
