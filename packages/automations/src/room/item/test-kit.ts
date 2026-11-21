// Tests only: an item with no cards on node:sqlite (its `tabs`, a link table and every Automations table and SQL
// trigger), a registry with a few kinds of an app's own, and a kit that records what it was asked. Not a `.test.ts`
// file, so vitest does not collect it.
import type { TelemetryWireEvent } from '@liveworkspace/telemetry';
import {
  agentChangedTrigger,
  defineAction,
  defineItemKinds,
  defineTrigger,
  type ItemEvent,
  type ItemKinds,
  type ItemOutline,
  type ItemPart,
  type ItemRule,
  type ItemRuleBody,
} from '../../item';
import type { AutomationPerson } from '../../types';
import { whole } from '../../validate-read';
import type { AutomationMessage } from '../automation-sends';
import type { Sql } from '../sql';
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { ItemEngine } from './engine';
import type {
  ItemMessage,
  ItemOptOutLinks,
  ItemRoomKit,
  ItemSendSubject,
  SnapshotDone,
  StepOutcome,
} from './kit';
import { itemAutomationSchemaSteps } from './schema';

export const ANA: AutomationPerson = { id: 'ana', name: 'Ana Costa', color: '#111111' };
export const BEN: AutomationPerson = { id: 'ben', name: 'Ben Okafor', color: '#222222' };

/** An app's own kinds beside the shared ones: Everyone Left (settles after `left`, called off by `arrived`), Poll
 *  Ended (carries a value of its own), Agent Made Changes (the shared helper) and a step of its own. */
export const TEST_KINDS: ItemKinds = defineItemKinds({
  itemWord: 'document',
  collab: true,
  tabTemplates: true,
  triggers: [
    defineTrigger<{ kind: 'everyone_left'; minutes: number } & ItemPart>({
      kind: 'everyone_left',
      name: 'Everyone Left',
      group: 'People',
      line: 'the last person leaves a tab and it stays empty',
      format: '{"kind":"everyone_left","minutes":1 to 720}',
      hears: [],
      tabbed: true,
      read: (value, path) => ({
        kind: 'everyone_left',
        minutes: whole(value['minutes'], `${path}.minutes`, 1, 720),
      }),
      defaults: () => ({ kind: 'everyone_left', minutes: 5 }),
      matches: () => true,
      words: () => [{ chip: 'Everyone Left', trigger: true }],
      said: () => 'Everyone left',
      settle: {
        after: ['left'],
        cancel: ['arrived'],
        quietMs: (t) => t.minutes * 60_000,
        key: (event) => event.tab ?? '',
      },
    }),
    defineTrigger({
      kind: 'poll_ended',
      name: 'Poll Ended',
      group: 'Workshop',
      line: 'a facilitator ends a live poll',
      format: '{"kind":"poll_ended"}',
      hears: ['poll_ended'],
      read: () => ({ kind: 'poll_ended' }),
      defaults: () => ({ kind: 'poll_ended' }),
      matches: () => true,
      words: () => [{ chip: 'Poll Ended', trigger: true }],
      said: (_t, event) => `${event.by?.name ?? 'Someone'} ended a poll`,
    }),
    agentChangedTrigger({ line: 'an agent changes a tab', note: 'once per changeset' }),
  ],
  actions: [
    defineAction({
      kind: 'clear_box',
      name: 'Clear the Box',
      group: 'Workshop',
      line: 'deletes every note in the box',
      format: '{"kind":"clear_box"}',
      read: () => ({ kind: 'clear_box' }),
      defaults: () => ({ kind: 'clear_box' }),
      words: () => [{ chip: 'Clear the Box' }],
      would: () => 'Would clear the box',
    }),
    defineAction({
      kind: 'unwired',
      name: 'Unwired',
      group: 'Workshop',
      line: 'a step the room has no runner for',
      format: '{"kind":"unwired"}',
      read: () => ({ kind: 'unwired' }),
      defaults: () => ({ kind: 'unwired' }),
      words: () => [{ chip: 'Unwired' }],
      would: () => 'Would do nothing',
    }),
  ],
  values: [
    {
      name: 'poll.question',
      label: 'Poll Question',
      under: ['poll_ended'],
      fill: (ctx) => String(ctx.event.data?.['poll.question'] ?? ''),
    },
  ],
});

const TABLES = `
CREATE TABLE tabs (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0);
CREATE TABLE document_tabs (document_id TEXT NOT NULL, tab_id TEXT NOT NULL, PRIMARY KEY (document_id, tab_id));
`;

/** An item's SQLite with its tab tables, and the database under it (for a test that prepares a statement once);
 *  `automations`: with every Automations table and trigger too. */
export function itemDb(automations = true): { db: DatabaseSync; sql: Sql } {
  const db = new DatabaseSync(':memory:');
  const sql = nodeItemSql(db) as unknown as Sql;
  const exec = (query: string) =>
    sql.exec(query) as unknown as { toArray(): Record<string, unknown>[] };
  exec(TABLES);
  if (automations)
    for (const step of itemAutomationSchemaSteps({ links: 'document_tabs' })) {
      if (typeof step.run === 'string') exec(step.run);
      else step.run(exec);
    }
  return { db, sql };
}

export const itemSql = (automations = true): Sql => itemDb(automations).sql;

export const rowsOf = (sql: Sql, query: string, ...bindings: unknown[]) =>
  sql.exec(query, ...bindings).toArray() as Record<string, unknown>[];

export const queued = (sql: Sql): ItemEvent[] =>
  rowsOf(sql, 'SELECT event FROM automation_queue ORDER BY id').map(
    (r) => JSON.parse(String(r['event'])) as ItemEvent,
  );

export interface World {
  db: DatabaseSync;
  sql: Sql;
  kit: ItemRoomKit;
  engine: ItemEngine;
  outline: ItemOutline;
  armed: { count: number };
  // What the kit was asked.
  taken: { name: string; author: AutomationPerson }[];
  reverted: string[];
  mailed: { to: string; mail: ItemMessage; links?: ItemOptOutLinks }[];
  posted: AutomationMessage<ItemSendSubject>[];
  events: TelemetryWireEvent[];
  deferred: Promise<unknown>[];
  cleared: { count: number };
  state: { putAway: boolean; ready: boolean; held: boolean };
  // The item's tabs, written as an app writes them.
  addTab(id: string, name?: string): void;
  editTab(id: string): void;
  removeTab(id: string): void;
  // A rule, saved.
  rule(body: Partial<ItemRuleBody> & { id?: string; enabled?: boolean }): ItemRule;
  // Everything the kit deferred, settled.
  settled(): Promise<void>;
}

export function world(over: Partial<ItemRoomKit> = {}): World {
  const { db, sql } = itemDb();
  const armed = { count: 0 };
  const state = { putAway: false, ready: true, held: true };
  const outline: ItemOutline = {
    name: 'Launch Plan',
    url: 'https://app.example/d/1',
    ownerId: ANA.id,
    tabs: [],
    people: [
      { id: ANA.id, name: ANA.name },
      { id: BEN.id, name: BEN.name },
    ],
  };
  const w = {
    db,
    sql,
    outline,
    armed,
    state,
    taken: [],
    reverted: [],
    mailed: [],
    posted: [],
    events: [],
    deferred: [],
    cleared: { count: 0 },
  } as unknown as World;
  const tabs = () =>
    rowsOf(
      sql,
      'SELECT t.id, t.name FROM tabs t JOIN document_tabs l ON l.tab_id = t.id ORDER BY t.rowid',
    ).map((r) => ({ id: String(r['id']), name: String(r['name']) }));
  w.kit = {
    kinds: TEST_KINDS,
    itemId: 'item-1',
    itemWord: 'document',
    category: 'Document',
    outline: () => Promise.resolve({ ...outline, tabs: tabs() }),
    tabUrl: (id) => `${outline.url}?tab=${id}`,
    snapshots: {
      list: () => Promise.resolve([{ id: 'snap-1', name: 'Clean board' }]),
      take: (name, author): Promise<SnapshotDone> => {
        w.taken.push({ name, author });
        return Promise.resolve({ ok: true });
      },
      revert: (id): Promise<SnapshotDone> => {
        if (id !== 'snap-1') return Promise.resolve({ ok: false, reason: 'snapshot_missing' });
        w.reverted.push(id);
        // A revert rewrites the tabs: nothing of it may reach Automations.
        w.editTab('t1');
        return Promise.resolve({ ok: true });
      },
    },
    text: (tab) => Promise.resolve(tab ? `Text of ${tab}` : 'The whole text'),
    addTab: (_template, name) => {
      const id = `added-${tabs().length}`;
      w.addTab(id, name);
      return Promise.resolve({ id, name });
    },
    mail: {
      optOutDoor: (token) => `https://app.example/optout/${token}`,
      optOutPage: (token) => `https://app.example/unsubscribe/${token}`,
      sendToAddress: (to, mail, links) => {
        w.mailed.push({ to, mail, links });
        return Promise.resolve();
      },
      sendToPerson: (personId, mail) => {
        if (personId === 'nobody') return Promise.resolve(false);
        w.mailed.push({ to: personId, mail });
        return Promise.resolve(true);
      },
    },
    sends: {
      push: (_itemId, messages) => {
        w.posted.push(...messages);
        return Promise.resolve(messages.map((m) => ({ key: m.key, queued: true as const })));
      },
    },
    ai: { client: null },
    run: {
      clear_box: (): Promise<StepOutcome> => {
        w.cleared.count += 1;
        return Promise.resolve({ ok: true, text: 'Cleared the box' });
      },
    },
    telemetry: (events) => {
      w.events.push(...events);
      return Promise.resolve();
    },
    hookUrl: (ruleId) => `https://app.example/api/hooks/automations/item-1/${ruleId}`,
    putAway: () => state.putAway,
    defer: (promise) => void w.deferred.push(promise),
    ...over,
  };
  w.engine = new ItemEngine({
    sql: () => sql,
    ready: () => state.ready,
    arm: () => void (armed.count += 1),
    kinds: TEST_KINDS,
    kit: () => (state.held ? w.kit : null),
    putAway: () => state.putAway,
  });
  w.addTab = (id, name = `Tab ${id}`) => {
    sql.exec('INSERT INTO tabs (id, name, data) VALUES (?, ?, ?)', id, name, '{}');
    sql.exec('INSERT INTO document_tabs (document_id, tab_id) VALUES (?, ?)', 'item-1', id);
  };
  w.editTab = (id) =>
    void sql.exec('UPDATE tabs SET data = data || ?, rev = rev + 1 WHERE id = ?', ' ', id);
  w.removeTab = (id) => {
    sql.exec('DELETE FROM document_tabs WHERE tab_id = ?', id);
    sql.exec('DELETE FROM tabs WHERE id = ?', id);
  };
  let made = 0;
  w.rule = (body) => {
    made += 1;
    const stamp = { by: ANA, at: 1000 };
    const rule: ItemRule = {
      id: body.id ?? `r${made}`,
      name: body.name ?? `Rule ${made}`,
      trigger: body.trigger ?? { kind: 'manual' },
      conditions: body.conditions ?? [],
      steps: body.steps ?? [{ kind: 'take_snapshot', name: 'Kept' }],
      chain: body.chain ?? false,
      timeZone: body.timeZone ?? 'UTC',
      enabled: body.enabled ?? true,
      made: stamp,
      edited: stamp,
    };
    w.engine.store.insert(rule);
    return rule;
  };
  w.settled = async () => {
    await Promise.all(w.deferred.splice(0));
  };
  return w;
}
