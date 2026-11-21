import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../types';
import { kitMail } from './kit-mail';
import { designItemOutline, designTabUrl, designUrl } from './kit-outline';
import { designText } from './kit-text';
import { designKit } from './design-kit';
import { ensureSchema } from '../design-room-content';
import { ANA, BEN, box, DOC, roomWorld, type RoomWorld } from './test-automation-world';

// The kit's bindings that reach outside the design's own SQLite (blueprint automations.md "The kit"): the people an
// outline names, a person's email, a rule's messages through the index, and the text Summarise reads.

const people = vi.hoisted(() => ({
  team: null as null | { userId: string | null; name: string | null; status: string }[],
  addresses: new Map<string, string>(),
}));
vi.mock('../../accounts/notify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../accounts/notify')>()),
  teamPeople: async () => people.team,
  notifyRecipients: async (_env: unknown, ids: readonly string[], setting: string) => {
    asked.push(setting);
    return new Map(
      ids.filter((id) => people.addresses.has(id)).map((id) => [id, people.addresses.get(id)!]),
    );
  },
}));
const asked: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  people.team = null;
  people.addresses.clear();
  asked.length = 0;
});

async function started(extra: Partial<Env> = {}): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const w = roomWorld(extra);
  await w.create([
    { id: 't1', name: 'Letter', elements: [box('a', 'Checkout')] },
    { id: 't2', name: 'Deck', elements: [box('n', 'Remember')] },
  ]);
  return w;
}

describe('the outline', () => {
  it('names the design, its link, its tabs in order and its owner', async () => {
    const w = await started();
    const env = w.room.requireEnv();
    expect(await designItemOutline(env, DOC)).toMatchObject({
      name: 'Launch',
      url: 'https://www.livedesign.app/design/doc-1',
      ownerId: ANA,
      tabs: [
        { id: 't1', name: 'Letter' },
        { id: 't2', name: 'Deck' },
      ],
      people: [{ id: ANA, name: 'The owner' }],
    });
    expect(designUrl({ ...env, APP_BASE_URL: 'https://x.test/' }, 'a b')).toBe(
      'https://x.test/design/a%20b',
    );
    expect(designTabUrl(env, DOC, 't 2')).toBe('https://www.livedesign.app/design/doc-1#t=t%202');
  });

  it("names a team design's joined people, never an invitation, and never an address", async () => {
    const w = await started();
    w.db.prepare('UPDATE design SET team_id = ?').run('team-1');
    people.team = [
      { userId: BEN, name: 'Ben Okafor', status: 'joined' },
      { userId: 'user_cy', name: null, status: 'joined' },
      { userId: null, name: null, status: 'invited' },
    ];
    const outline = await designItemOutline(w.room.requireEnv(), DOC);
    expect(outline.people).toEqual([
      { id: BEN, name: 'Ben Okafor' },
      { id: 'user_cy', name: 'Someone' },
      { id: ANA, name: 'The owner' },
    ]);
    expect(JSON.stringify(outline)).not.toContain('@');
  });

  it('answers a design not started as nothing much', async () => {
    const w = roomWorld();
    w.room.bindDesign(DOC);
    ensureSchema(w.room);
    expect(await designItemOutline(w.room.requireEnv(), DOC)).toMatchObject({
      name: 'Untitled',
      ownerId: '',
      tabs: [],
      people: [],
    });
  });
});

describe('the text', () => {
  it('answers one tab’s outline, every tab’s under its name, and nothing for a tab that is gone', async () => {
    const w = await started();
    const env = w.room.requireEnv();
    const one = await designText(env, DOC, 't2');
    expect(one).toContain('Remember');
    expect(one).not.toContain('Checkout');
    const all = await designText(env, DOC);
    expect(all.indexOf('# Letter')).toBeLessThan(all.indexOf('# Deck'));
    expect(await designText(env, DOC, 'nope')).toBe('');
  });
});

describe('the components a rule picks', () => {
  it('answers the mains the library still holds, and leaves any other pick alone', async () => {
    const w = await started();
    const put = await w.send('PUT', `/api/designs/${DOC}/components/c1`, {
      id: 'c1',
      name: 'Button',
      width: 120,
      height: 60,
      elements: [box('e1')],
      updatedAt: 0,
    });
    expect(put.status).toBe(200);
    const kit = designKit(w.room)!;
    expect([...(await kit.owns!('component', ['c1', 'gone']))]).toEqual(['c1']);
    expect([...(await kit.owns!('tab', ['x']))]).toEqual(['x']);
    expect(kit.run).toEqual({});
  });
});

describe('email to a person', () => {
  const sentTo = (w: { sent: { to: string; html: string }[] }) => w.sent.map((m) => m.to);
  function mailbox() {
    const sent: { to: string; subject: string; html: string }[] = [];
    const EMAIL = {
      send: async (message: { to: string; subject: string; html: string }) => {
        sent.push(message);
        return { messageId: 'm' };
      },
    };
    return { sent, env: { EMAIL } as unknown as Partial<Env> };
  }

  it('goes to their verified address unless they turned assigned-action emails off', async () => {
    const box_ = mailbox();
    const w = await started(box_.env);
    people.addresses.set(ANA, 'ana@example.com');
    const mail = kitMail(w.room.requireEnv(), DOC)!;
    const message = { subject: 'Review finished', body: 'All threads resolved', rule: 'Review' };
    expect(await mail.sendToPerson(ANA, message)).toBe(true);
    expect(sentTo(box_)).toEqual(['ana@example.com']);
    expect(box_.sent[0]!.html).toContain('Launch');
    expect(asked).toEqual(['notifyActionAssigned']);
    // Opted out, or no verified address: nothing is sent, and the step says so.
    expect(await mail.sendToPerson(BEN, message)).toBe(false);
    expect(box_.sent).toHaveLength(1);
  });

  it('is nobody’s without the EMAIL binding', async () => {
    const w = await started();
    expect(kitMail(w.room.requireEnv(), DOC)).toBeNull();
  });
});
