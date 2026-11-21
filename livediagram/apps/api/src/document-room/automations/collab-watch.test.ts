import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CollabActionRow, CollabThreadRow, Element } from '@livediagram/document';
import { AUTOMATION_PERSON_ID } from '@liveworkspace/automations';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { COLLAB_BASELINE_TABS } from '@liveworkspace/automations/room';
import { ANA, box, DOC, roomWorld, type RoomWorld } from './test-automation-world';

// The comment and action triggers (docs/specs/013-workspace/automations.md; blueprint automations.md "The collab
// diff"): worked out where the outbox already reads a changed tab, against the summary kept from the drain before.
// Nothing is kept or read while no rule hears one, a tab's standing threads start nothing, and neither does what
// was written while nobody listened.

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const comment = (id: string, text: string, at = 1) => ({
  id,
  text,
  createdAt: at,
  authorName: 'Ana Costa',
  authorColor: '#111111',
});

const withThread = (id: string, comments: ReturnType<typeof comment>[], resolved = false) =>
  ({ ...box(id), commentThread: { comments, resolved } }) as unknown as Element;

const withAction = (id: string, status: 'open' | 'done', assignee: string | null) =>
  ({
    ...box(id),
    actions: [
      {
        id: `${id}-act`,
        name: 'Confirm the budget',
        description: '',
        assignee: { userId: assignee, name: assignee ? 'Ben Okafor' : null },
        teamId: null,
        assignerId: ANA,
        assignerName: 'Ana Costa',
        status,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }) as unknown as Element;

async function started(elements: Element[] = [box('a')]): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Board', elements }]);
  return w;
}

// The room's alarm with the outbox due: the baseline, then the drain that diffs.
async function drained(w: RoomWorld): Promise<void> {
  w.room.flushAt = Date.now();
  await w.alarm();
}

const seen = (w: RoomWorld) => w.rows('SELECT tab_id FROM automation_collab_seen ORDER BY tab_id');

describe('with no rule that hears a comment or an action', () => {
  it('keeps nothing and reads nothing, whatever is written', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'tab_added' } });
    await w.saveTab('t1', [withThread('a', [comment('c1', 'Hello')])]);
    await drained(w);
    expect(seen(w)).toEqual([]);
    expect(w.room.collab.watching()).toBe(false);
    expect(w.room.collab.at).toBeNull();
    expect(w.queued()).toEqual([]);
  });
});

describe('Comment Added', () => {
  it('starts nothing for the threads standing when the rule is turned on, and hears the first comment after', async () => {
    const w = await started([withThread('a', [comment('c1', 'Before the rule')])]);
    await w.rule({ trigger: { kind: 'comment_added' } });
    // The baseline is owed at once.
    expect(w.room.collab.at).not.toBeNull();
    await drained(w);
    expect(seen(w)).toEqual([{ tab_id: 't1' }]);
    expect(w.queued()).toEqual([]);
    expect(w.room.collab.at).toBeNull();

    await w.saveTab('t1', [
      withThread('a', [comment('c1', 'Before the rule'), comment('c2', 'After the rule', 2)]),
      withThread('b', [comment('c3', 'A new thread', 3)]),
    ]);
    await drained(w);
    // The reply and the new thread each ran the rule; the standing comment never did.
    expect(w.runs().map((r) => (r['steps'] as { text: string }[])[0]!.text)).toEqual([
      'Ana Costa commented on Board',
      'Ana Costa commented on Board',
    ]);
  });

  it('carries the comment’s text and its author, and is kept to the rule’s tab', async () => {
    const w = await started();
    await w.send('PUT', `/api/documents/${DOC}/tabs/t2`, { id: 't2', name: 'Other', elements: [] });
    await w.rule({ trigger: { kind: 'comment_added', tab: 't2' } });
    await drained(w);
    await w.saveTab('t1', [withThread('a', [comment('c1', 'On the wrong tab')])]);
    await w.saveTab('t2', [withThread('z', [comment('c2', 'On the right tab')])], 'Other');
    // Read the queue before the wake runs it.
    w.room.flushAt = Date.now();
    const queuedBefore = w.queued();
    expect(queuedBefore).toEqual([]);
    const { drainOutbox } = await import('../document-outbox');
    await drainOutbox(w.room.requireEnv(), DOC, null);
    expect(w.queued()).toMatchObject([
      { kind: 'comment_added', tab: 't1', by: { id: ANA }, data: { comment: 'On the wrong tab' } },
      { kind: 'comment_added', tab: 't2', by: { id: ANA }, data: { comment: 'On the right tab' } },
    ]);
    await w.alarm();
    // Only the rule's tab ran; the other is no match.
    expect(w.runs().map((r) => r['result'])).toEqual(['done']);
  });

  it('starts nothing for a comment a rule itself wrote', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'comment_added' } });
    await drained(w);
    const thread = (count: number, authorId: string): CollabThreadRow => ({
      elementId: 'a',
      elementLabel: 'a',
      resolved: false,
      commentCount: count,
      participantIds: [],
      mentionedIds: [],
      latestText: 'Automation wrote this',
      latestAuthorName: 'Tell People',
      latestAuthorColor: '#000',
      latestAuthorId: authorId,
      firstAt: 1,
      latestAt: 2,
    });
    const byRule = await w.room.collab.note(
      't1',
      { threads: [thread(1, AUTOMATION_PERSON_ID)], actions: [] },
      Date.now(),
      async () => null,
    );
    expect(byRule).toBe(0);
    const byPerson = await w.room.collab.note(
      't1',
      { threads: [thread(2, ANA)], actions: [] },
      Date.now(),
      async () => null,
    );
    expect(byPerson).toBe(1);
  });
});

describe('threads and actions', () => {
  it('hears a thread resolved, the last open one resolved, an action assigned and an action done, by whoever alone saved', async () => {
    const w = await started([
      withThread('a', [comment('c1', 'One')]),
      withThread('b', [comment('c2', 'Two')]),
      withAction('x', 'open', null),
    ]);
    for (const kind of ['thread_resolved', 'threads_resolved', 'action_assigned', 'action_done'])
      await w.rule({ trigger: { kind } });
    await drained(w);
    const { drainOutbox } = await import('../document-outbox');
    const kinds = async () => {
      await drainOutbox(w.room.requireEnv(), DOC, null);
      const out = w.queued();
      w.db.exec('DELETE FROM automation_queue');
      return out;
    };

    await w.saveTab('t1', [
      withThread('a', [comment('c1', 'One')], true),
      withThread('b', [comment('c2', 'Two')]),
      withAction('x', 'open', 'user_ben'),
    ]);
    expect(await kinds()).toMatchObject([
      { kind: 'thread_resolved', tab: 't1', by: { id: ANA } },
      { kind: 'action_assigned', tab: 't1', by: { id: ANA }, data: { assignee: 'Ben Okafor' } },
    ]);

    await w.saveTab('t1', [
      withThread('a', [comment('c1', 'One')], true),
      withThread('b', [comment('c2', 'Two')], true),
      withAction('x', 'done', 'user_ben'),
    ]);
    expect((await kinds()).map((e) => e.kind)).toEqual([
      'thread_resolved',
      'threads_resolved',
      'action_done',
    ]);
    // The same tab again: nothing changed, nothing queued, nothing written.
    expect(await kinds()).toEqual([]);
  });
});

describe('when the last such rule goes', () => {
  it('empties what it kept, so a rule turned on later never answers what was written while nobody listened', async () => {
    const w = await started();
    const rule = await w.rule({ trigger: { kind: 'comment_added' } });
    await drained(w);
    expect(seen(w)).toHaveLength(1);
    await w.send('POST', `/api/documents/${DOC}/automations/${rule.id}/toggle`, { enabled: false });
    expect(seen(w)).toEqual([]);
    await w.saveTab('t1', [withThread('a', [comment('c1', 'While nobody listened')])]);
    await drained(w);
    await w.send('POST', `/api/documents/${DOC}/automations/${rule.id}/toggle`, { enabled: true });
    await drained(w);
    expect(w.runs()).toEqual([]);
    // Put away is the same: nothing kept, nothing heard.
    await w.room.takeStanding(DOC, { archived: true, trashed: false, at: Date.now() });
    expect(seen(w)).toEqual([]);
  });

  it('forgets a tab that is gone', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'comment_added' } });
    await drained(w);
    expect(await w.room.collab.note('t1', null, Date.now(), async () => null)).toBe(0);
    expect(seen(w)).toEqual([]);
  });
});

describe('the baseline', () => {
  it('reads a bounded number of tabs a wake, and finishes over the wakes that follow', async () => {
    const w = await started();
    const now = Date.now();
    const extra = COLLAB_BASELINE_TABS + 3;
    for (let i = 0; i < extra; i += 1) {
      w.db
        .prepare(
          'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, 0, 1)',
        )
        .run(`x${i}`, `X ${i}`, '{"elements":[]}', now);
      w.db
        .prepare(
          'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)',
        )
        .run(DOC, `x${i}`, 10 + i, now);
    }
    w.db.exec('DELETE FROM outbox');
    await w.rule({ trigger: { kind: 'comment_added' } });
    expect(w.room.collab.baseline(Date.now())).toBe(COLLAB_BASELINE_TABS);
    expect(w.room.collab.at).not.toBeNull();
    // Not before its pause is over.
    expect(w.room.collab.baseline(Date.now())).toBe(0);
    expect(w.room.collab.baseline(Date.now() + 5000)).toBe(4);
    expect(w.room.collab.at).toBeNull();
    expect(seen(w)).toHaveLength(extra + 1);
  });
});

describe('cost', () => {
  // The worst case a drain meets: a tab of hundreds of threads and actions, one of them changed. The diff reads the
  // kept summary, compares, and writes it back: linear in the threads, and a small part of the parse the drain
  // already pays for the Inbox.
  const THREADS = 600;
  const rowsOf = (resolved: number) => ({
    threads: Array.from({ length: THREADS }, (_, i): CollabThreadRow => ({
      elementId: `element-${i}`,
      elementLabel: `Element ${i}`,
      resolved: i < resolved,
      commentCount: 3,
      participantIds: [ANA],
      mentionedIds: [],
      latestText: 'A comment of ordinary length, as people write them on a canvas.',
      latestAuthorName: 'Ana Costa',
      latestAuthorColor: '#111111',
      latestAuthorId: ANA,
      firstAt: 1,
      latestAt: 2,
    })),
    actions: Array.from({ length: THREADS }, (_, i): CollabActionRow => ({
      elementId: `element-${i}`,
      actionId: `action-${i}`,
      elementLabel: `Element ${i}`,
      name: 'Do the thing',
      description: '',
      status: 'open',
      assigneeUserId: ANA,
      assigneeMemberId: null,
      assigneeName: 'Ana Costa',
      assignerId: ANA,
      assignerName: 'Ana Costa',
      teamId: null,
      createdAt: 1,
      updatedAt: 1,
    })),
  });

  it('diffs a tab of 600 threads and 600 actions inside its CPU budget', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'thread_resolved' } });
    await drained(w);
    const nobody = async () => null;
    await w.room.collab.note('t1', rowsOf(0), Date.now(), nobody);
    let best = Infinity;
    for (let round = 1; round <= 5; round += 1) {
      const rows = rowsOf(round);
      const ms = await cpuMsOfAsync(() => w.room.collab.note('t1', rows, Date.now(), nobody));
      best = Math.min(best, ms);
    }
    console.log(
      `[collab-watch] diff of ${THREADS} threads + ${THREADS} actions: ${best.toFixed(2)} ms CPU`,
    );
    // Measured about 1.5 ms on an Apple-silicon laptop (2026-11-20): the budget is several times that.
    expect(best).toBeLessThan(cpuBudgetMs(15));
    // Each round resolved one more thread, and queued exactly that.
    expect(w.queued().filter((e) => e.kind === 'thread_resolved')).toHaveLength(5);
  });

  it('costs an unchanged tab one read and no write', async () => {
    const w = await started();
    await w.rule({ trigger: { kind: 'comment_added' } });
    await drained(w);
    const rows = rowsOf(0);
    await w.room.collab.note('t1', rows, Date.now(), async () => null);
    const before = w.rows('SELECT total_changes() AS n')[0]!['n'];
    expect(await w.room.collab.note('t1', rows, Date.now(), async () => null)).toBe(0);
    expect(w.rows('SELECT total_changes() AS n')[0]!['n']).toBe(before);
  });
});
