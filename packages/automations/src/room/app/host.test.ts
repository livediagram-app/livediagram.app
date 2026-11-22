import { describe, expect, it, vi } from 'vitest';
import { queued, rowsOf, world, ANA } from '../item/test-kit';
import { ITEM_WRITER_MS, withItemWriter } from '../item/writer';
import {
  SOMEONE,
  asCrossAppStep,
  asTabWriter,
  cutTo,
  hearsEvent,
  keptSnapshots,
  queueAgentChanged,
  queueEvent,
  roleOfLevel,
  silently,
  writerOf,
} from './host';

const taken = (id: string) => ({ id, kind: 'snapshot_taken', at: 1 });

describe('a call site', () => {
  it('does nothing outside a room, or while no rule hears the kind', () => {
    const w = world();
    expect(hearsEvent({}, 'snapshot_taken')).toBe(false);
    expect(queueEvent({}, taken('a'))).toBe(false);
    const host = { AUTOMATIONS: w.engine };
    expect(hearsEvent(host, 'snapshot_taken')).toBe(false);
    expect(queueEvent(host, taken('a'))).toBe(false);
    expect(queued(w.sql)).toEqual([]);
  });

  it('queues the event once a rule that is on hears it', () => {
    const w = world();
    w.rule({ trigger: { kind: 'snapshot_taken' } });
    const host = { AUTOMATIONS: w.engine };
    expect(hearsEvent(host, 'snapshot_taken')).toBe(true);
    expect(queueEvent(host, { ...taken('a'), by: ANA, role: 'editor' })).toBe(true);
    expect(queued(w.sql)).toMatchObject([{ id: 'a', kind: 'snapshot_taken', by: { id: ANA.id } }]);
  });

  it('queues what a step from another app’s route writes in its chain, as the automation’s', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'snapshot_taken' } });
    w.rule({ trigger: { kind: 'tab_added' } });
    const host = { AUTOMATIONS: w.engine };
    const chain = { id: 'c1', hops: 1, rules: ['liveplanner:p:r'] };
    const own = { id: 'b', kind: 'snapshot_taken', at: 1, cross: { id: 'c0', hops: 2, rules: [] } };
    await asCrossAppStep(host, { author: ANA, chain }, async () => {
      queueEvent(host, { ...taken('a'), by: ANA, role: 'editor' });
      queueEvent(host, own);
      w.addTab('t1');
    });
    queueEvent(host, taken('c'));
    expect(queued(w.sql).map((e) => [e.id.slice(0, 1), e.role, e.cross?.id])).toEqual([
      ['a', 'automation', 'c1'],
      ['b', undefined, 'c0'],
      ['t', 'automation', 'c1'],
      ['c', undefined, undefined],
    ]);
    // Outside a room it is the write alone.
    await expect(asCrossAppStep({}, { author: ANA, chain }, async () => 7)).resolves.toBe(7);
  });

  it('queues Agent Made Changes by the token’s name, only while a rule hears it', () => {
    const w = world();
    const host = { AUTOMATIONS: w.engine };
    const write = { key: 'cs1', tab: 't1', author: ANA, tokenName: 'Robot' };
    expect(queueAgentChanged(host, write)).toBe(false);
    w.rule({ trigger: { kind: 'agent_changed' } });
    expect(queueAgentChanged(host, write)).toBe(true);
    expect(queueAgentChanged(host, { key: 'cs2', author: ANA })).toBe(true);
    const [first, second] = queued(w.sql);
    expect(first).toMatchObject({
      id: 'agent:cs1',
      kind: 'agent_changed',
      tab: 't1',
      role: 'agent',
      by: { name: 'Robot' },
    });
    expect(second).toMatchObject({ id: 'agent:cs2', by: { name: 'An agent' } });
    expect(second).not.toHaveProperty('tab');
  });

  it('reads a share level as a role, and cuts a text by characters', () => {
    expect(roleOfLevel('edit')).toBe('editor');
    expect(roleOfLevel('participate')).toBe('participant');
    expect(roleOfLevel('view')).toBe('viewer');
    expect(roleOfLevel(undefined)).toBe('viewer');
    expect(cutTo('short', 10)).toBe('short');
    expect(cutTo('ab😀cd', 3)).toBe('ab😀');
    expect(SOMEONE).toEqual({ id: '', name: 'Someone', color: '#94a3b8' });
    const ana = { ...ANA, extra: 'never carried' };
    expect(writerOf(ana, null)).toEqual({ by: ANA, role: 'editor' });
    expect(writerOf(ana, { name: ' Robot ' })).toEqual({
      by: { ...ANA, name: 'Robot' },
      role: 'agent',
    });
    expect(writerOf(ana, { name: null }).by.name).toBe('An agent');
    expect(writerOf(ana, {}).by.name).toBe('An agent');
  });
});

describe('a tab write', () => {
  it('runs alone, and asks nobody who, while no rule hears the kind', async () => {
    const w = world();
    const who = vi.fn();
    expect(await asTabWriter({}, 'tab_added', who, () => 'done')).toBe('done');
    await asTabWriter({ AUTOMATIONS: w.engine }, 'tab_added', who, () => w.addTab('t1'));
    expect(who).not.toHaveBeenCalled();
    expect(queued(w.sql)).toEqual([]);
  });

  it('says who made it when a rule hears it', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    await asTabWriter(
      { AUTOMATIONS: w.engine },
      'tab_added',
      async () => ({ by: ANA, role: 'editor' }),
      () => w.addTab('t1', 'Roadmap'),
    );
    expect(queued(w.sql)).toMatchObject([
      { kind: 'tab_added', tab: 't1', by: { id: ANA.id }, role: 'editor' },
    ]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });
});

describe('a person’s tab write inside a rule’s step', () => {
  const RULE = { role: 'automation' as const, rule: 'r9', chain: 1 };
  const person = async () => ({ by: ANA, role: 'editor' as const });

  it('is the person’s, and the step’s later writes are the rule’s again', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    const host = { AUTOMATIONS: w.engine };
    await withItemWriter(w.sql, { who: RULE, own: true }, async () => {
      // The step awaits; meanwhile a person adds a tab.
      await asTabWriter(host, 'tab_added', person, () => w.addTab('t1', 'Theirs'));
      w.addTab('t2', 'The rule’s');
    });
    expect(queued(w.sql)).toMatchObject([
      { kind: 'tab_added', tab: 't1', by: { id: ANA.id }, role: 'editor' },
      { kind: 'tab_added', tab: 't2', role: 'automation', rule: 'r9', chain: 1 },
    ]);
    expect(queued(w.sql)[0]).not.toHaveProperty('rule');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });

  it('keeps the person’s window when the rule’s closes first, and clears it last', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let personDone!: Promise<void>;
    await withItemWriter(w.sql, { who: RULE, own: true }, async () => {
      personDone = withItemWriter(w.sql, { who: { by: ANA, role: 'editor' } }, async () => {
        await held;
        w.addTab('t3', 'Late');
      });
      await Promise.resolve();
    });
    // The rule's window closed while the person's was open: the row is still the person's.
    expect(
      JSON.parse(rowsOf(w.sql, 'SELECT who FROM automation_writer')[0]!['who'] as string),
    ).toMatchObject({
      role: 'editor',
    });
    release();
    await personDone;
    expect(queued(w.sql)).toMatchObject([{ tab: 't3', role: 'editor' }]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });

  it('puts back no window that lapsed meanwhile', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await withItemWriter(w.sql, { who: RULE, own: true }, async () => {
      await withItemWriter(w.sql, { who: { by: ANA, role: 'editor' } }, async () => {
        now.mockReturnValue(1_000 + ITEM_WRITER_MS + 1);
      });
      expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
    });
    now.mockRestore();
  });
});

describe('a revert', () => {
  it('writes alone while no rule hears a tab change', async () => {
    const w = world();
    w.addTab('t1');
    expect(await silently({}, async () => 'ok')).toBe('ok');
    w.rule({ trigger: { kind: 'snapshot_taken' } });
    expect(await silently({ AUTOMATIONS: w.engine }, async () => 'ok')).toBe('ok');
    w.state.held = false;
    expect(await silently({ AUTOMATIONS: w.engine }, async () => 'ok')).toBe('ok');
  });

  it('is no edit, no tab added and no tab removed to the rules', async () => {
    const w = world();
    w.addTab('t1');
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    w.rule({ trigger: { kind: 'tab_added' } });
    await silently({ AUTOMATIONS: w.engine }, async () => {
      w.editTab('t1');
      w.addTab('t2');
    });
    expect(queued(w.sql)).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    w.editTab('t1');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toHaveLength(1);
  });
});

describe('the snapshots kept for rules', () => {
  it('are the ones the rules name, and none outside a room', () => {
    const w = world();
    expect(keptSnapshots({})).toEqual([]);
    w.rule({ steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1' }] });
    expect(keptSnapshots({ AUTOMATIONS: w.engine })).toEqual(['snap-1']);
  });
});
