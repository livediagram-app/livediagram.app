import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemPersonId } from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { USER, automationWorld, type AutomationWorld } from './test-automation-world';

// A rule's Send Email (docs/specs/026-plan/automations.md "Actions"): to a person of the plan with an account, unless
// they turned these emails off, never failing the run.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);
const sent = vi.hoisted(() => [] as { to: string; subject: string; html: string }[]);
const optedOut = vi.hoisted(() => new Set<string>());
vi.mock('../../email/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../email/client')>()),
  emailEnabled: () => true,
  sendEmail: async (_env: unknown, msg: { to: string; subject: string; html: string }) => {
    sent.push(msg);
    return { sent: true };
  },
}));
vi.mock('../../person/notify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../person/notify')>()),
  notifyRecipients: async (_env: unknown, ids: string[]) =>
    new Map(ids.filter((id) => !optedOut.has(id)).map((id) => [id, `${id}@example.test`])),
}));

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  sent.length = 0;
  optedOut.clear();
  w = await automationWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const settle = () => new Promise((r) => setTimeout(r, 10));

async function doneWithAssignee(assignee: { id: string; name: string; color: string }) {
  await w.rule({
    steps: [
      {
        kind: 'email',
        to: { assignee: true },
        subject: 'Done: {{card.title}}',
        body: 'Line one\n<b>{{card.title}}</b>',
      },
    ],
  });
  const c = await w.make('A', { title: 'Ship <it>', assignee });
  await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
  await w.plans.get('A')!.room.alarm();
  await settle();
}

describe('Send Email', () => {
  it('emails an account person of the plan, escaped, with the card link', async () => {
    w.plans
      .get('A')!
      .db.prepare('INSERT INTO known_people (person_id, seen_at) VALUES (?, 1)')
      .run(USER);
    await doneWithAssignee({ id: await itemPersonId(USER), name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: `${USER}@example.test`, subject: 'Done: Ship <it>' });
    expect(sent[0]!.html).toContain('Line one<br>&lt;b&gt;Ship &lt;it&gt;&lt;/b&gt;');
    expect(sent[0]!.html).toContain('#item=');
  });

  it('sends nothing to someone who turned these off, or to a person with no account', async () => {
    w.plans
      .get('A')!
      .db.prepare('INSERT INTO known_people (person_id, seen_at) VALUES (?, 1)')
      .run(USER);
    optedOut.add(USER);
    await doneWithAssignee({ id: await itemPersonId(USER), name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(0);
    const [run] = (await (await w.call('GET', '/runs')).json<{ runs: { result: string }[] }>())
      .runs;
    expect(run!.result).toBe('done');
  });

  it('sends nothing to a name typed onto the card', async () => {
    await doneWithAssignee({ id: 'n-ali', name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(0);
  });
});
