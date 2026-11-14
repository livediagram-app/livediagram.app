// capCollabPush by bytes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): a tab's
// collab push always fits the index's body limit, keeps its newest rows, and is the same whatever order they came in.
import { describe, expect, it } from 'vitest';
import {
  COLLAB_MAX_ACTIONS,
  COLLAB_MAX_THREADS,
  COLLAB_PEOPLE_MAX,
  COLLAB_TEXT_MAX,
  INDEX_BODY_MAX_BYTES,
  type CollabActionInput,
  type CollabPush,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { capCollabPush, jsonBytes } from './outbox';

const sentBytes = (push: CollabPush) => new TextEncoder().encode(JSON.stringify(push)).byteLength;
// The longest id the index takes (INDEX_ID_MAX), so every person costs the most it can.
const person = (i: number) => `person-${String(i).padStart(120, '0')}`;
// Comment text past what the index keeps, in three- and four-byte characters (CJK and emoji).
const LONG_TEXT = '会議の議題 🚀 '.repeat(2_000);

function thread(i: number, over: Partial<CollabThreadInput> = {}): CollabThreadInput {
  return {
    elementId: `el-${i}:A${i}`,
    elementLabel: `Sheet cell A${i} ${'ラベル'.repeat(60)}`,
    resolved: false,
    commentCount: 40,
    participantIds: Array.from({ length: 150 }, (_, p) => person(p)),
    mentionedIds: Array.from({ length: 150 }, (_, p) => person(p + 500)),
    latestText: LONG_TEXT,
    latestAuthorName: 'Ada Lovelace',
    firstAt: 1,
    latestAt: 1_000 + i,
    ...over,
  };
}

function action(i: number, over: Partial<CollabActionInput> = {}): CollabActionInput {
  return {
    elementId: `el-${i}`,
    actionId: `a-${i}`,
    elementLabel: 'Step',
    name: `Action ${i}`,
    description: LONG_TEXT,
    status: 'open',
    assigneeId: person(1),
    assignerId: person(2),
    teamId: null,
    createdAt: 1,
    updatedAt: 1_000 + i,
    ...over,
  };
}

// A seeded shuffle, so the order test is the same on every run.
function shuffled<T>(list: readonly T[], seed = 7): T[] {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1_103_515_245 + 12_345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('capCollabPush by bytes', () => {
  it('keeps the worst case (500 threads of long text and many mentions) under the index limit, fast', () => {
    const push: CollabPush = {
      tabName: 'Budget',
      threads: Array.from({ length: COLLAB_MAX_THREADS }, (_, i) => thread(i)),
      actions: Array.from({ length: COLLAB_MAX_ACTIONS }, (_, i) => action(i)),
    };
    // Uncapped, the push is many times the limit.
    expect(sentBytes(push)).toBeGreaterThan(20 * INDEX_BODY_MAX_BYTES);
    let capped: CollabPush = push;
    const ms = cpuMsOf(() => {
      capped = capCollabPush(push);
    });
    const bytes = sentBytes(capped);
    console.info(
      `[capCollabPush] worst case: ${ms.toFixed(1)} ms CPU, ${capped.threads.length} threads + ${capped.actions.length} actions, ${bytes} bytes`,
    );
    expect(bytes).toBeLessThanOrEqual(INDEX_BODY_MAX_BYTES);
    // Filled close to the limit, not cut far short of it.
    expect(bytes).toBeGreaterThan(INDEX_BODY_MAX_BYTES - 30_000);
    expect(capped.threads.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });

  it('counts the bytes it sends exactly', () => {
    const push = capCollabPush({
      tabName: 'Ünïcødé ✓ 🚀',
      threads: Array.from({ length: 60 }, (_, i) => thread(i)),
      actions: [action(1)],
    });
    expect(jsonBytes(push)).toBe(sentBytes(push));
    // A lone surrogate (text cut through an emoji) is escaped by JSON.stringify, so it costs six ASCII bytes.
    for (const text of ['\ud83d', 'a🚀b', 'é', '\u0000"\\', ''])
      expect(jsonBytes({ text })).toBe(new TextEncoder().encode(JSON.stringify({ text })).length);
  });

  it('keeps every row newer than any it leaves out, threads and actions together', () => {
    const threads = Array.from({ length: 200 }, (_, i) => thread(2 * i));
    const actions = Array.from({ length: 200 }, (_, i) => action(2 * i + 1));
    const capped = capCollabPush({ threads, actions }, 200_000);
    const keptTimes = [
      ...capped.threads.map((t) => t.latestAt),
      ...capped.actions.map((a) => a.updatedAt),
    ];
    const kept = new Set(keptTimes);
    const dropped = [...threads.map((t) => t.latestAt), ...actions.map((a) => a.updatedAt)].filter(
      (t) => !kept.has(t),
    );
    expect(capped.threads.length).toBeGreaterThan(0);
    expect(capped.actions.length).toBeGreaterThan(0);
    expect(dropped.length).toBeGreaterThan(0);
    expect(Math.min(...keptTimes)).toBeGreaterThan(Math.max(...dropped));
    expect(sentBytes(capped)).toBeLessThanOrEqual(200_000);
  });

  it('is the same push whatever order the rows came in, ties broken by id', () => {
    // Every row at the same time: only the ids order them.
    const threads = Array.from({ length: 120 }, (_, i) =>
      thread(i, { latestAt: 5, participantIds: ['p'], mentionedIds: [], latestText: 'Hi' }),
    );
    const actions = Array.from({ length: 120 }, (_, i) =>
      action(i % 60, { updatedAt: 5, actionId: `a-${i}` }),
    );
    const one = capCollabPush({ threads, actions }, 100_000);
    const other = capCollabPush(
      { threads: shuffled(threads), actions: shuffled(actions, 11) },
      100_000,
    );
    expect(other).toEqual(one);
    // Equal times: threads go first, then the actions by element and action id, as many as fit.
    expect(one.threads.length).toBe(threads.length);
    expect(one.actions.length).toBeGreaterThan(0);
    expect(one.actions.length).toBeLessThan(actions.length);
    expect(one.actions.map((a) => a.actionId).slice(0, 3)).toEqual(['a-0', 'a-60', 'a-1']);
  });

  it('cuts each row as the index would, and lists past the people cap to their first distinct ids', () => {
    const repeated = [person(1), person(1), ...Array.from({ length: 120 }, (_, p) => person(p))];
    const [cut] = capCollabPush({
      threads: [thread(1, { mentionedIds: repeated, agentIds: repeated })],
      actions: [],
    }).threads;
    expect(cut!.latestText).toBe(LONG_TEXT.slice(0, COLLAB_TEXT_MAX));
    expect(cut!.mentionedIds).toHaveLength(COLLAB_PEOPLE_MAX);
    expect(new Set(cut!.mentionedIds).size).toBe(COLLAB_PEOPLE_MAX);
    expect(cut!.mentionedIds[0]).toBe(person(1));
    expect(cut!.agentIds).toEqual(cut!.mentionedIds);
    // Short lists and text, and an action without a note, go as they came.
    const small = thread(2, { participantIds: ['p'], mentionedIds: [], latestText: 'Hi' });
    const bare = action(3, { description: undefined });
    const plain = capCollabPush({ threads: [small], actions: [bare] });
    expect(plain.threads[0]).toEqual(small);
    expect(plain.actions[0]).toBe(bare);
    expect(plain.actions[0]!.description).toBeUndefined();
    expect(
      capCollabPush({ threads: [], actions: [action(4)] }).actions[0]!.description,
    ).toHaveLength(COLLAB_TEXT_MAX);
  });

  it('sends no rows when not even the newest fits', () => {
    expect(capCollabPush({ tabName: 'T', threads: [thread(1)], actions: [action(2)] }, 50)).toEqual(
      { tabName: 'T', threads: [], actions: [] },
    );
  });
});
