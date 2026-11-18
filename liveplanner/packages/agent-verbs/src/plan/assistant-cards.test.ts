import { describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  itemAssistantFor,
  itemPersonId,
  type Item,
  type ItemFields,
} from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { assistantOnce, callerAssistant, handedToOf } from './assistant-caller';
import { handBackRefusal, isMe } from './hand-back';
import { applyItemChanges } from './item-changes';
import { listItemsPage } from './list-items-page';
import { itemLister } from './plan-listing';
import { readPlanState } from './plan-state';

// docs/specs/026-plan/plan-agents.md "Cards handed to an assistant": which assistant is calling, list_items'
// handedToMe, change_items' "me" and hand_back, and their refusals.

const D = 'doc1';
const ACCOUNT = 'acct_thomas';
const OTHER = { id: 'b'.repeat(24), name: 'Sam Lee', color: '#16a34a' };
const plan = {
  boards: [
    {
      id: 'b',
      kind: 'board',
      title: 'Board',
      columns: [
        { status: 'todo~x', name: 'To Do' },
        { status: 'done~x', name: 'Done', done: true },
      ],
    },
  ],
  statuses: [
    { status: 'todo~x', name: 'To Do' },
    { status: 'done~x', name: 'Done' },
  ],
  types: ITEM_TYPES,
};

async function world(opts: { tokenName?: string | null; token?: 'none' | 'broken' } = {}) {
  const thomasId = await itemPersonId(ACCOUNT);
  const thomas = { id: thomasId, name: 'Thomas McClean', color: '#2563eb' };
  const claude = itemAssistantFor(thomas, 'Claude')!;
  const samsClaude = itemAssistantFor(OTHER, 'Claude')!;
  const make = (id: string, key: number, fields: ItemFields): Item => ({
    id,
    type: 'task',
    key,
    rank: 'k',
    fields: { status: 'todo~x', ...fields },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: thomas,
    updatedBy: thomas,
  });
  const items = [
    make('aaa111', 1, { title: 'Write copy', assignee: claude }),
    make('bbb222', 2, { title: 'Fix login', assignee: OTHER }),
    make('ccc333', 3, { title: 'Draw logo', assignee: samsClaude }),
    make('ddd444', 4, { title: 'Ship it', assignee: claude, status: 'done~x' }),
  ];
  const writes: { id: string; set: ItemFields }[] = [];
  let reads = 0;
  const write = (it: Item) => async (r: Request) => {
    const body = (await r.json()) as { set: ItemFields };
    writes.push({ id: it.id, set: body.set });
    return Response.json({ item: { ...it, fields: { ...it.fields, ...body.set } } });
  };
  const api = fakeApi({
    [`/projects/${D}/items`]: { items, rev: 1 },
    [`/projects/${D}/plan`]: plan,
    '/tokens/current': async () => {
      reads += 1;
      if (opts.token === 'none') return Response.json({ error: 'not_a_token' }, { status: 403 });
      if (opts.token === 'broken') return Response.json({ error: 'boom' }, { status: 500 });
      return Response.json({
        accountId: ACCOUNT,
        accountName: 'Thomas McClean',
        tokenId: 'tok_1',
        tokenName: opts.tokenName === undefined ? 'Claude' : opts.tokenName,
        role: 'full',
        expiresAt: 1,
      });
    },
    ...Object.fromEntries(items.map((it) => [`/projects/${D}/items/${it.id}`, write(it)])),
  });
  return { api, items, thomas, claude, samsClaude, writes, reads: () => reads };
}

describe('the calling assistant', () => {
  it('is the token’s tool and person, named and coloured as the plan’s cards show the person', async () => {
    const w = await world();
    const read = await callerAssistant(w.api, w.items);
    expect(read).toEqual({ ok: true, assistant: w.claude });
  });

  it('takes the account’s name and a Plan swatch when no card shows the person', async () => {
    const w = await world();
    const read = await callerAssistant(w.api, []);
    if (!read.ok) throw new Error('refused');
    expect(read.assistant.id).toBe(w.claude.id);
    expect(read.assistant.name).toBe('Claude (Thomas)');
    expect(read.assistant.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('finds the person on a card they last changed, and names one with no account name Someone', async () => {
    const w = await world();
    const edited = { ...w.items[1]!, createdBy: OTHER, updatedBy: w.thomas };
    expect(await callerAssistant(w.api, [edited])).toEqual({ ok: true, assistant: w.claude });
    const api = fakeApi({
      '/tokens/current': {
        accountId: ACCOUNT,
        accountName: ' ',
        tokenId: 't',
        tokenName: 'Claude',
        role: 'full',
        expiresAt: 1,
      },
    });
    const read = await callerAssistant(api, []);
    expect(read.ok && read.assistant.name).toBe('Claude (Someone)');
  });

  it('is no assistant for a session, or a token without a name', async () => {
    for (const opts of [{ token: 'none' as const }, { tokenName: null }, { tokenName: '  ' }]) {
      const w = await world(opts);
      expect(await callerAssistant(w.api, w.items)).toMatchObject({
        ok: false,
        code: 'not_an_assistant',
      });
    }
  });

  it('throws any other api failure', async () => {
    const w = await world({ token: 'broken' });
    await expect(callerAssistant(w.api, w.items)).rejects.toThrow();
  });

  it('is read once a call, and only when asked', async () => {
    const w = await world();
    expect(await handedToOf(w.api, w.items, false)).toEqual({ ok: true });
    expect(w.reads()).toBe(0);
    const once = assistantOnce(w.api, () => w.items);
    await once();
    await once();
    expect(w.reads()).toBe(1);
  });

  it('reads "me" case and spacing aside', () => {
    expect(isMe(' Me ')).toBe(true);
    expect(isMe('Mel')).toBe(false);
    expect(isMe(3)).toBe(false);
  });
});

describe('list_items and the cards handed to an assistant', () => {
  it('lists an assistant Assignee as one, with who it works for', async () => {
    const w = await world();
    const listed = itemLister(await readPlanState(w.api, D))(w.items[0]!);
    expect(listed.fields['assignee']).toEqual({
      id: w.claude.id,
      name: 'Claude (Thomas)',
      color: w.claude.color,
      assistant: true,
      worksFor: 'Thomas McClean',
    });
    // A person reads as stored.
    expect(itemLister(await readPlanState(w.api, D))(w.items[1]!).fields['assignee']).toEqual(
      OTHER,
    );
  });

  it('keeps only the open cards handed to the caller with handedToMe, each marked', async () => {
    const w = await world();
    const state = await readPlanState(w.api, D);
    const handed = await handedToOf(w.api, state.items, true);
    if (!handed.ok) throw new Error('refused');
    const page = listItemsPage(
      state,
      {},
      { includeClosed: false, includeRich: false, limit: 50, after: 0, handedTo: handed.handedTo! },
      { url: 'u' },
    );
    expect(page.items.map((i) => [i.ref, i.handedToYou])).toEqual([['T-1', true]]);
    // The done card it holds is closed: left out and counted.
    expect(page.omitted?.closed).toBe(1);
  });

  it('refuses handedToMe to a caller that is no assistant', async () => {
    const w = await world({ token: 'none' });
    expect(await handedToOf(w.api, w.items, true)).toMatchObject({ code: 'not_an_assistant' });
  });
});

describe('change_items hands cards over and back', () => {
  it('hands a card to "me" on a set, and names it in the line', async () => {
    const w = await world();
    const state = await readPlanState(w.api, D);
    const r = await applyItemChanges(
      w.api,
      D,
      [{ op: 'set', item: '#2', fields: { Assignee: 'me' } }],
      state,
    );
    expect(r.refusal).toBeUndefined();
    expect(w.writes).toEqual([{ id: 'bbb222', set: { assignee: w.claude } }]);
    expect(r.applied[0]).toMatch(/set assignee = Claude \(Thomas\)$/);
  });

  it('hands a new card to "me"', async () => {
    const w = await world();
    let made: unknown;
    const api = fakeApi({
      [`/projects/${D}/items`]: async (r: Request) => {
        if (r.method === 'GET') return Response.json({ items: w.items, rev: 1 });
        made = await r.json();
        return Response.json({ item: { ...w.items[1]!, id: 'new', key: 9 } });
      },
      [`/projects/${D}/plan`]: plan,
      '/tokens/current': {
        accountId: ACCOUNT,
        accountName: 'Thomas McClean',
        tokenId: 't',
        tokenName: 'Claude',
        role: 'full',
        expiresAt: 1,
      },
    });
    const state = await readPlanState(api, D);
    const r = await applyItemChanges(
      api,
      D,
      [{ op: 'add', title: 'New', fields: { assignee: 'ME' } }],
      state,
    );
    expect(r.refusal).toBeUndefined();
    expect((made as { fields: ItemFields }).fields['assignee']).toEqual(w.claude);
  });

  it('hands a card back to the assistant’s person', async () => {
    const w = await world();
    const state = await readPlanState(w.api, D);
    const r = await applyItemChanges(w.api, D, [{ op: 'hand_back', item: '#1' }], state);
    expect(r.refusal).toBeUndefined();
    expect(w.writes).toEqual([{ id: 'aaa111', set: { assignee: w.thomas } }]);
    expect(r.applied[0]).toMatch(/^~ T-1 .*Write copy.*; handed back to Thomas McClean$/);
  });

  it('refuses to hand back a card someone else, another assistant or no one holds', async () => {
    const w = await world();
    const state = await readPlanState(w.api, D);
    for (const [item, whose] of [
      ['#2', "#2 is Sam Lee's"],
      ['#3', "#3 is Claude (Sam)'s"],
    ] as const) {
      const r = await applyItemChanges(w.api, D, [{ op: 'hand_back', item }], state);
      expect(r.refusal?.code).toBe('not_handed_to_you');
      expect(r.refusal?.message).toContain(whose);
    }
    expect(w.writes).toEqual([]);
    const free = { ...w.items[1]!, fields: { title: 'Free' } } as Item;
    expect(handBackRefusal(free, w.claude).message).toContain('handed to no one');
  });

  it('refuses "me" and hand_back to a caller that is no assistant, before any write', async () => {
    const w = await world({ token: 'none' });
    const state = await readPlanState(w.api, D);
    for (const change of [
      { op: 'set' as const, item: '#2', fields: { assignee: 'me' } },
      { op: 'hand_back' as const, item: '#1' },
    ]) {
      const r = await applyItemChanges(w.api, D, [change], state);
      expect(r.refusal?.code).toBe('not_an_assistant');
    }
    expect(w.writes).toEqual([]);
  });

  it('answers a Viewer’s token as the api refuses it (403), as any write', async () => {
    const w = await world();
    const api = fakeApi({
      [`/projects/${D}/items`]: { items: w.items, rev: 1 },
      [`/projects/${D}/plan`]: plan,
      '/tokens/current': {
        accountId: ACCOUNT,
        accountName: 'Thomas McClean',
        tokenId: 't',
        tokenName: 'Claude',
        role: 'full',
        expiresAt: 1,
      },
      [`/projects/${D}/items/aaa111`]: async () =>
        Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    const state = await readPlanState(api, D);
    const r = await applyItemChanges(api, D, [{ op: 'hand_back', item: '#1' }], state);
    expect(r.refusal?.code).toBe('forbidden');
    expect(r.applied).toEqual([]);
  });
});
