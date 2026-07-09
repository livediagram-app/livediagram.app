import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_LOG_LIST_LIMIT, type ChangeLogEntry } from '@livediagram/api-schema';
import {
  appendLog,
  offlineAppendChangeLogEntry,
  offlineDeleteChangeLogEntry,
  offlineDeleteChangeLogForTab,
  offlineListChangeLog,
  removeLogEntry,
  removeLogForTab,
} from './offline-change-log';
import {
  __setOfflineBackend,
  offlineCreateDiagram,
  offlineLoadTab,
  offlineSaveTab,
} from './offline-store';
import { memBackend, testRecord as rec, testTab as tab } from './offline-test-utils';

const entry = (id: string, over: Partial<ChangeLogEntry> = {}): ChangeLogEntry => ({
  id,
  tabId: 't1',
  participantId: 'p1',
  participantName: 'Pat',
  participantColor: '#123456',
  kind: 'edit',
  summary: `entry ${id}`,
  elementIds: [],
  beforeState: {},
  afterState: {},
  createdAt: 100,
  ...over,
});

afterEach(() => __setOfflineBackend(null));

describe('offline change-log transforms', () => {
  it('appendLog prepends newest-first and tolerates a record without a log', () => {
    const one = appendLog(rec(), entry('e1'));
    const two = appendLog(one, entry('e2'));
    expect(two.log?.map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('appendLog caps at the panel limit, dropping the oldest', () => {
    let out = rec();
    for (let i = 0; i < CHANGE_LOG_LIST_LIMIT + 2; i++) out = appendLog(out, entry(`e${i}`));
    expect(out.log).toHaveLength(CHANGE_LOG_LIST_LIMIT);
    expect(out.log?.[0]?.id).toBe(`e${CHANGE_LOG_LIST_LIMIT + 1}`);
    expect(out.log?.map((e) => e.id)).not.toContain('e0');
  });

  it('removeLogEntry drops just that entry', () => {
    const seeded = rec({ log: [entry('e2'), entry('e1')] });
    expect(removeLogEntry(seeded, 'e1').log?.map((e) => e.id)).toEqual(['e2']);
  });

  it('removeLogForTab drops every entry for the tab', () => {
    const seeded = rec({
      log: [entry('e3', { tabId: 't2' }), entry('e2'), entry('e1')],
    });
    expect(removeLogForTab(seeded, 't1').log?.map((e) => e.id)).toEqual(['e3']);
  });
});

describe('offline change-log ops (in-memory backend)', () => {
  it('append → list → delete entry → delete for tab round-trip', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDiagram({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);

    await offlineAppendChangeLogEntry('d1', entry('e1'));
    await offlineAppendChangeLogEntry('d1', entry('e2'));
    await offlineAppendChangeLogEntry('d1', entry('e3', { tabId: 't2' }));
    expect((await offlineListChangeLog('d1')).map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);

    await offlineDeleteChangeLogEntry('d1', 'e2');
    expect((await offlineListChangeLog('d1')).map((e) => e.id)).toEqual(['e3', 'e1']);

    await offlineDeleteChangeLogForTab('d1', 't1');
    expect((await offlineListChangeLog('d1')).map((e) => e.id)).toEqual(['e3']);
  });

  it('lists empty for an unknown diagram and appends without creating one', async () => {
    __setOfflineBackend(memBackend());
    expect(await offlineListChangeLog('nope')).toEqual([]);
    await offlineAppendChangeLogEntry('nope', entry('e1'));
    expect(await offlineListChangeLog('nope')).toEqual([]);
  });

  it('log entries survive a tab save (whole-record rewrite keeps the log)', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDiagram({ id: 'd1', name: 'Doc', tabs: [tab('t1')] }, 100);
    await offlineAppendChangeLogEntry('d1', entry('e1'));

    await offlineSaveTab('d1', tab('t1', { name: 'Edited' }), 200);

    expect((await offlineLoadTab('d1', 't1'))?.name).toBe('Edited');
    expect((await offlineListChangeLog('d1')).map((e) => e.id)).toEqual(['e1']);
  });
});
