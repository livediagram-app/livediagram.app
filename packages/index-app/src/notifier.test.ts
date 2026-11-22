import { DatabaseSync } from 'node:sqlite';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JOIN_NOTIFY_THROTTLE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { createNotifier, type NotifierDeps, type NotifierEmail } from './notifier';
import type { SenderAllowance } from './notify-claims';

// The item's notify_claims table behind the D1 surface an app hands in (its Durable Object's facade).
function claimsDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    'CREATE TABLE notify_claims (key TEXT PRIMARY KEY, sender TEXT NOT NULL, at INTEGER NOT NULL)',
  );
  const prepare = (query: string) => {
    assertD1Compound(query);
    const statement = (bindings: unknown[]) => ({
      bind: (...more: unknown[]) => statement([...bindings, ...more]),
      run: async () => {
        const out = sql.prepare(query).run(...(bindings as never[]));
        return { meta: { changes: Number(out.changes) } };
      },
    });
    return statement([]);
  };
  const db = {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
  } as unknown as D1Database;
  const rows = () =>
    sql.prepare('SELECT key, sender, at FROM notify_claims ORDER BY rowid').all() as {
      key: string;
      sender: string;
      at: number;
    }[];
  return { db, rows };
}

type Env = { email: boolean };
type Sent = NotifierEmail & { to: string };

// One app's notifier over fakes: who is reachable, the item's claims, the sender's allowance, and plain templates.
function setup(opts: { reachable?: Record<string, string>; allow?: number; made?: number } = {}) {
  const reachable = opts.reachable ?? {};
  const store = claimsDb();
  const sent: Sent[] = [];
  let allowanceLeft = opts.allow ?? Infinity;
  const allowance: SenderAllowance = async ({ count }) => {
    const taken = Math.min(count, allowanceLeft);
    allowanceLeft -= taken;
    return taken;
  };
  const deps: NotifierDeps<Env> = {
    enabled: (env) => env.email,
    send: async (_env, email) => void sent.push(email),
    isAccount: (id) => id.startsWith('user_'),
    recipients: vi.fn(
      async (_env: Env, ids: readonly string[]) =>
        new Map(ids.flatMap((id) => (reachable[id] ? [[id, reachable[id]] as const] : []))),
    ),
    itemsMadeBy: vi.fn(async () => opts.made ?? 0),
    claimMilestone: vi.fn(async () => true),
    claims: () => store.db,
    allowance: () => allowance,
    nameOf: async (_env, id) => (id === 'user_anna' ? 'Anna' : null),
    teamPeople: vi.fn(async () => team),
    settings: { join: 'notifyItemJoin' },
    emails: {
      milestone: (_env, count) => ({ subject: `milestone ${count}`, html: '' }),
      firstShare: () => ({ subject: 'first share', html: '' }),
      joined: (_env, item, who) => ({ subject: `joined ${item}`, html: String(who) }),
      actionAssigned: (_env, who, item, action) => ({
        subject: `action ${action}`,
        html: `${who} ${item?.name ?? 'no item'}`,
      }),
      mentioned: (_env, who, item, text, part) => ({
        subject: `${who} mentioned you in ${item.name}`,
        html: `${text} ${part ?? ''}`,
      }),
    },
  };
  return { notifier: createNotifier(deps), deps, sent, store };
}

const on: Env = { email: true };
const off: Env = { email: false };
const item = { id: 'd1', name: 'Roadmap', ownerId: 'user_u1' };
const person = (id: string, userId: string | null, email: string | null): TeamPerson =>
  ({
    id,
    userId,
    email,
    name: null,
    role: 'member',
    status: userId ? 'joined' : 'invited',
  }) as TeamPerson;
const priya = person('m-2', 'user_priya', 'priya-invite@x.com');
const invited = person('m-3', null, 'invited@x.com');
const author = person('m-1', 'user_u1', null);
const team = [author, priya, invited];

afterEach(() => vi.restoreAllMocks());

describe('notifyJoin', () => {
  it('emails the owner once per throttle window, naming the joiner', async () => {
    const { notifier, deps, sent, store } = setup({ reachable: { user_u1: 'owner@x.test' } });
    await notifier.notifyJoin(on, item, 'user_anna');
    await notifier.notifyJoin(on, item, 'user_anna');
    expect(deps.recipients).toHaveBeenCalledWith(on, ['user_u1'], 'notifyItemJoin');
    expect(sent).toEqual([{ subject: 'joined Roadmap', html: 'Anna', to: 'owner@x.test' }]);
    expect(store.rows()).toMatchObject([{ key: 'join', sender: 'user_u1' }]);
    expect(JOIN_NOTIFY_THROTTLE_MS).toBeGreaterThan(0);
  });

  it('spends no claim when the owner opted out, and never writes for a guest or the owner', async () => {
    const { notifier, sent, store } = setup();
    await notifier.notifyJoin(on, item, 'user_anna');
    expect(store.rows()).toEqual([]);
    const reached = setup({ reachable: { user_u1: 'owner@x.test' } });
    await reached.notifier.notifyJoin(on, item, '0f5ca4af-9a8a-4a60-be5e-1179e5555880');
    await reached.notifier.notifyJoin(on, item, 'user_u1');
    await reached.notifier.notifyJoin(off, item, 'user_anna');
    expect([...sent, ...reached.sent]).toEqual([]);
  });
});

describe('notifyActionAssigned', () => {
  const input = {
    assignee: priya,
    assignerUserId: 'user_u1',
    assignerName: 'Sam',
    item,
    assigneeCanOpen: true,
    actionName: 'Review the copy',
    description: null,
  };

  it('sends to the verified address, or an invited person at their invite address', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    await notifier.notifyActionAssigned(on, input);
    await notifier.notifyActionAssigned(on, { ...input, assignee: invited });
    expect(deps.recipients).toHaveBeenCalledOnce();
    expect(sent.map((e) => e.to)).toEqual(['priya@x.com', 'invited@x.com']);
  });

  it('skips an account that opted out: never its invite address', async () => {
    const { notifier, sent, store } = setup();
    await notifier.notifyActionAssigned(on, input);
    expect(sent).toEqual([]);
    expect(store.rows()).toEqual([]);
  });

  it('claims each email against the assigner, keyed on what it says and to whom', async () => {
    const { notifier, sent, store } = setup({ reachable: { user_priya: 'priya@x.com' } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await notifier.notifyActionAssigned(on, input);
    await notifier.notifyActionAssigned(on, input);
    await notifier.notifyActionAssigned(on, { ...input, actionName: 'Something else' });
    const rows = store.rows();
    expect(rows.map((r) => r.sender)).toEqual(['user_u1', 'user_u1']);
    expect(rows[0]!.key).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.map((e) => e.subject)).toEqual(['action Review the copy', 'action Something else']);
  });

  it('sends nothing when the assigner is over the hourly cap', async () => {
    const { notifier, sent, store } = setup({
      reachable: { user_priya: 'priya@x.com' },
      allow: 0,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await notifier.notifyActionAssigned(on, input);
    expect(sent).toEqual([]);
    // A refused claim leaves nothing behind, so the email may go once the hour allows.
    expect(store.rows()).toEqual([]);
    expect(NOTIFY_EMAILS_PER_SENDER_PER_HOUR).toBeGreaterThan(0);
  });

  it('leaves the item out for an assignee who cannot open it', async () => {
    const { notifier, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    await notifier.notifyActionAssigned(on, { ...input, assigneeCanOpen: false });
    expect(sent[0]!.html).toBe('Sam no item');
  });
});

describe('notifyMentions', () => {
  const comment = (id: string, mentions: { userId?: string; memberId?: string }[]) => ({
    id,
    text: `comment ${id}`,
    mentions,
  });
  const input = {
    item: { ...item, teamId: 'team1' },
    authorId: 'user_u1',
    mentionsMax: 10,
    comments: [comment('c1', [{ userId: 'user_priya' }, { memberId: 'm-3' }]), comment('c2', [])],
  };

  it("emails each teammate a comment mentions, once per comment, through the item's team", async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    await notifier.notifyMentions(on, input);
    await notifier.notifyMentions(on, input);
    expect(deps.teamPeople).toHaveBeenCalledWith(on, 'team1');
    expect(sent.map((e) => e.to).sort()).toEqual(['invited@x.com', 'priya@x.com']);
    expect(sent[0]!.html).toBe('comment c1 ');
  });

  it('passes the part the comment sits on to the email', async () => {
    const { notifier, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    await notifier.notifyMentions(on, { ...input, partId: 'card-1' });
    expect(sent[0]!.html).toBe('comment c1 card-1');
  });

  it('reaches no one from an author outside the team, or on an item with no team', async () => {
    const { notifier, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    await notifier.notifyMentions(on, { ...input, authorId: 'user_stranger' });
    await notifier.notifyMentions(on, { ...input, item: { ...input.item, teamId: null } });
    expect(sent).toEqual([]);
  });
});

describe('notifyMentioned', () => {
  const input = {
    recipients: [priya],
    authorUserId: 'user_u1',
    authorName: 'Sam',
    item,
    commentText: 'Can you check this, @priya?',
  };

  it('sends the quote to the verified address, or the invite address, once', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_priya: 'priya@x.com' } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await notifier.notifyMentioned(on, { ...input, recipients: [priya, invited] })).toEqual([
      priya.id,
      invited.id,
    ]);
    // The same quote again is a refused claim: nobody emailed, and the caller hears so.
    expect(await notifier.notifyMentioned(on, input)).toEqual([]);
    expect(deps.recipients).toHaveBeenCalledWith(on, ['user_priya'], 'notifyMentions');
    expect(sent.map((e) => [e.to, e.subject])).toEqual([
      ['priya@x.com', 'Sam mentioned you in Roadmap'],
      ['invited@x.com', 'Sam mentioned you in Roadmap'],
    ]);
  });

  it('does nothing when email is off, for no one, or when the recipient opted out', async () => {
    const { notifier, sent } = setup();
    expect(await notifier.notifyMentioned(off, input)).toEqual([]);
    expect(await notifier.notifyMentioned(on, { ...input, recipients: [] })).toEqual([]);
    expect(await notifier.notifyMentioned(on, input)).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('milestones', () => {
  it('celebrates the tenth item and the first share once each, when opted in', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_u1: 'me@x.com' }, made: 10 });
    await notifier.notifyMilestone(on, 'user_u1');
    await notifier.notifyFirstShare(on, 'user_u1');
    expect(deps.claimMilestone).toHaveBeenCalledTimes(2);
    expect(sent.map((e) => e.subject)).toEqual(['milestone 10', 'first share']);
  });

  it('sends nothing short of a milestone, for a guest, or when opted out', async () => {
    const { notifier, sent } = setup({ reachable: { user_u1: 'me@x.com' }, made: 9 });
    await notifier.notifyMilestone(on, 'user_u1');
    await notifier.notifyMilestone(on, 'guest');
    const optedOut = setup({ made: 10 });
    await optedOut.notifier.notifyMilestone(on, 'user_u1');
    expect([...sent, ...optedOut.sent]).toEqual([]);
    expect(optedOut.deps.claimMilestone).not.toHaveBeenCalled();
  });
});

describe('notifyApprovalRequested', () => {
  const notice = {
    type: 'approval_requested' as const,
    approvalId: 'ap_1',
    requesterId: 'user_anna',
    requesterName: 'Anna',
    approverIds: ['user_b', 'user_c', 'guest_g'],
    itemTitle: 'Roadmap',
    note: 'Check the dates',
    due: '2026-11-20',
  };
  const on = { email: true };

  it('emails each approver with an address and the switch on, never a guest', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_b: 'b@x.test' } });
    deps.emails.approvalRequested = (_env, input) => ({
      subject: `${input.requesterName} asked you to approve ${input.item.name}`,
      html: `${input.note} ${input.due} ${input.item.id}`,
    });
    await notifier.notifyApprovalRequested(on, 'item_1', notice);
    expect(deps.recipients).toHaveBeenCalledWith(on, ['user_b', 'user_c'], 'notifyActionAssigned');
    expect(sent).toEqual([
      {
        subject: 'Anna asked you to approve Roadmap',
        html: 'Check the dates 2026-11-20 item_1',
        to: 'b@x.test',
      },
    ]);
  });

  it('sends nothing with email off, no template or nobody to email', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_b: 'b@x.test' } });
    await notifier.notifyApprovalRequested(on, 'item_1', notice);
    deps.emails.approvalRequested = () => ({ subject: 's', html: '' });
    await notifier.notifyApprovalRequested({ email: false }, 'item_1', notice);
    await notifier.notifyApprovalRequested(on, 'item_1', { ...notice, approverIds: ['guest_g'] });
    expect(sent).toEqual([]);
    expect(deps.recipients).not.toHaveBeenCalled();
  });
});

describe('notifyAccessRequested', () => {
  const notice = {
    type: 'access_requested' as const,
    requestId: 'req_1',
    requesterId: 'user_anna',
    requesterName: 'Anna',
    recipientIds: ['user_b', 'user_c', 'guest_g'],
    itemTitle: 'Roadmap',
    note: 'On the launch team',
  };
  const on = { email: true };

  it('emails each manager with an address and the join switch on, never a guest', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_b: 'b@x.test' } });
    deps.emails.accessRequested = (_env, input) => ({
      subject: `${input.requesterName} asked for access to ${input.item.name}`,
      html: `${input.note} ${input.requestId} ${input.item.id}`,
    });
    await notifier.notifyAccessRequested(on, 'item_1', notice);
    expect(deps.recipients).toHaveBeenCalledWith(on, ['user_b', 'user_c'], 'notifyItemJoin');
    expect(sent).toEqual([
      {
        subject: 'Anna asked for access to Roadmap',
        html: 'On the launch team req_1 item_1',
        to: 'b@x.test',
      },
    ]);
  });

  it('sends nothing with email off, no template or nobody to email', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_b: 'b@x.test' } });
    await notifier.notifyAccessRequested(on, 'item_1', notice);
    deps.emails.accessRequested = () => ({ subject: 's', html: '' });
    await notifier.notifyAccessRequested({ email: false }, 'item_1', notice);
    await notifier.notifyAccessRequested(on, 'item_1', { ...notice, recipientIds: ['guest_g'] });
    expect(sent).toEqual([]);
    expect(deps.recipients).not.toHaveBeenCalled();
  });
});

describe('notifyAccessGranted', () => {
  const notice = {
    type: 'access_granted' as const,
    requestId: 'req_1',
    requesterId: 'user_anna',
    granterId: 'user_b',
    granterName: 'Bo',
    level: 'view' as const,
    itemTitle: 'Roadmap',
  };
  const on = { email: true };

  it('emails the requester at their verified address, whatever their switches', async () => {
    const { notifier, deps, sent } = setup();
    const addresses = vi.fn(async () => new Map([['user_anna', 'anna@x.test']]));
    deps.addresses = addresses;
    deps.emails.accessGranted = (_env, input) => ({
      subject: `${input.granterName} shared ${input.item.name} with you`,
      html: `${input.level} ${input.item.id}`,
    });
    await notifier.notifyAccessGranted(on, 'item_1', notice);
    expect(addresses).toHaveBeenCalledWith(on, ['user_anna']);
    expect(deps.recipients).not.toHaveBeenCalled();
    expect(sent).toEqual([
      { subject: 'Bo shared Roadmap with you', html: 'view item_1', to: 'anna@x.test' },
    ]);
  });

  it('sends nothing with email off, no template, no address read, a guest or no address', async () => {
    const { notifier, deps, sent } = setup();
    await notifier.notifyAccessGranted(on, 'item_1', notice);
    deps.emails.accessGranted = () => ({ subject: 's', html: '' });
    await notifier.notifyAccessGranted(on, 'item_1', notice);
    const addresses = vi.fn(async () => new Map<string, string>());
    deps.addresses = addresses;
    await notifier.notifyAccessGranted({ email: false }, 'item_1', notice);
    await notifier.notifyAccessGranted(on, 'item_1', { ...notice, requesterId: 'guest_g' });
    expect(addresses).not.toHaveBeenCalled();
    await notifier.notifyAccessGranted(on, 'item_1', notice);
    expect(addresses).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });
});

// accounts.md "Notification emails", "An app's own notices": one email per account behind the app's own switch.
describe('notifyAccounts', () => {
  const emails = () =>
    new Map<string, NotifierEmail>([
      ['user_anna', { subject: 'for anna', html: 'a', text: 'a' }],
      ['guest_g', { subject: 'for a guest', html: 'g' }],
      ['user_bo', { subject: 'for bo', html: 'b' }],
      ['user_off', { subject: 'for off', html: 'o' }],
    ]);

  it('sends each account its own email at its verified address, in one recipients read', async () => {
    // user_off turned the switch off (or has no verified address): the recipients read leaves it out.
    const { notifier, deps, sent } = setup({
      reachable: { user_anna: 'anna@x.test', user_bo: 'bo@x.test' },
    });
    const emailed = await notifier.notifyAccounts(on, {
      setting: 'notifyKnowledgeReviews',
      emails: emails(),
    });
    expect(emailed).toEqual(['user_anna', 'user_bo']);
    expect(deps.recipients).toHaveBeenCalledTimes(1);
    // A guest is never asked about: it has no address.
    expect(deps.recipients).toHaveBeenCalledWith(
      on,
      ['user_anna', 'user_bo', 'user_off'],
      'notifyKnowledgeReviews',
    );
    expect(sent).toEqual([
      { subject: 'for anna', html: 'a', text: 'a', to: 'anna@x.test' },
      { subject: 'for bo', html: 'b', to: 'bo@x.test' },
    ]);
  });

  it('sends nothing with email off, nobody named, or only guests', async () => {
    const { notifier, deps, sent } = setup({ reachable: { user_anna: 'anna@x.test' } });
    expect(await notifier.notifyAccounts(off, { setting: 'notifyX', emails: emails() })).toEqual(
      [],
    );
    expect(await notifier.notifyAccounts(on, { setting: 'notifyX', emails: new Map() })).toEqual(
      [],
    );
    expect(
      await notifier.notifyAccounts(on, {
        setting: 'notifyX',
        emails: new Map([['guest_g', { subject: 's', html: '' }]]),
      }),
    ).toEqual([]);
    expect(deps.recipients).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});
