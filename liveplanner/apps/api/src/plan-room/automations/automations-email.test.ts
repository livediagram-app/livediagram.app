import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemPersonId } from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { USER, automationWorld, type AutomationWorld } from './test-automation-world';

// A rule's Send Email (docs/specs/026-plan/automations.md "Actions"): to a person of the plan with an account, unless
// they turned these emails off, never failing the run.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);
const sent = vi.hoisted(() => [] as { to: string; subject: string; html: string }[]);
const optedOut = vi.hoisted(() => new Set<string>());
// The plan's team as accounts holds it now: whom a person's own mention email reaches.
const team = vi.hoisted(() => [] as { id: string; userId: string; status: string }[]);
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
  teamPeople: async () => team,
}));

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  sent.length = 0;
  optedOut.clear();
  team.length = 0;
  w = await automationWorld();
});

// USER on the plan's team: the plan is the team's, and they are one of its people.
function onTeam(status = 'joined') {
  w.plans.get('A')!.db.prepare("UPDATE plan SET team_id = 'team_1' WHERE id = 'A'").run();
  team.push({ id: 'm1', userId: USER, status });
}
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
    onTeam();
    await doneWithAssignee({ id: await itemPersonId(USER), name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: `${USER}@example.test`, subject: 'Done: Ship <it>' });
    expect(sent[0]!.html).toContain('Line one<br>&lt;b&gt;Ship &lt;it&gt;&lt;/b&gt;');
    expect(sent[0]!.html).toContain('#item=');
  });

  it('sends nothing to someone who turned these off, or to a person with no account', async () => {
    onTeam();
    optedOut.add(USER);
    await doneWithAssignee({ id: await itemPersonId(USER), name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(0);
    const [run] = (await (await w.call('GET', '/runs')).json<{ runs: { result: string }[] }>())
      .runs;
    expect(run!.result).toBe('done');
  });

  it('reaches only whom a person’s own mention email would: never someone who left the team or a share link’s Editor', async () => {
    // Seen as an Editor (a share link, or a teammate since removed), on no team the plan has.
    w.plans
      .get('A')!
      .db.prepare('INSERT INTO known_people (person_id, seen_at) VALUES (?, 1)')
      .run(USER);
    await doneWithAssignee({ id: await itemPersonId(USER), name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(0);
    // The plan's team, without them.
    w.plans.get('A')!.db.prepare("UPDATE plan SET team_id = 'team_1' WHERE id = 'A'").run();
    team.push({ id: 'm2', userId: 'user_someone_else', status: 'joined' });
    const c = await w.make('A', {
      title: 'Again',
      assignee: { id: await itemPersonId(USER), name: 'Ali', color: '#112233' },
    });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    await w.plans.get('A')!.room.alarm();
    await settle();
    expect(sent).toHaveLength(0);
  });

  it('Mention Someone emails a teammate, and never someone off the team', async () => {
    await w.rule({
      steps: [{ kind: 'mention', to: { assignee: true }, text: 'Look at {{card.title}}' }],
    });
    const assignee = { id: await itemPersonId(USER), name: 'Ali', color: '#112233' };
    w.plans
      .get('A')!
      .db.prepare('INSERT INTO known_people (person_id, seen_at) VALUES (?, 1)')
      .run(USER);
    const first = await w.make('A', { title: 'One', assignee });
    await w.send('POST', `/api/projects/A/items/${first.id}/move`, { status: 'done' });
    await w.plans.get('A')!.room.alarm();
    await settle();
    expect(sent).toHaveLength(0);
    onTeam();
    const second = await w.make('A', { title: 'Two', assignee });
    await w.send('POST', `/api/projects/A/items/${second.id}/move`, { status: 'done' });
    await w.plans.get('A')!.room.alarm();
    await settle();
    expect(sent.map((m) => m.to)).toEqual([`${USER}@example.test`]);
  });

  it('sends nothing to a name typed onto the card', async () => {
    await doneWithAssignee({ id: 'n-ali', name: 'Ali', color: '#112233' });
    expect(sent).toHaveLength(0);
  });
});
