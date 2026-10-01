// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeLogEntry } from '@livediagram/api-schema';
import type { Element, TextElement } from '@livediagram/document';
import { emptyEntryHistory } from '@/lib/entry-history';
import { useActivityLogEmitter } from './useActivityLogEmitter';

// docs/specs/012-collaboration/activity-and-audit.md "An entry too large to store becomes a
// summary": a change over the server's cap is logged as a summary entry (no Revert), and a failed
// append is logged, never swallowed.

const api = vi.hoisted(() => ({
  apiAppendChangeLogEntry: vi.fn(),
  apiDeleteChangeLogEntry: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

const text = (i: number): TextElement =>
  ({
    id: `t-${i}`,
    type: 'text',
    x: i,
    y: 0,
    width: 100,
    height: 20,
    label: 'x'.repeat(300),
  }) as TextElement;

function harness() {
  let log: ChangeLogEntry[] = [];
  const send = vi.fn();
  const { result } = renderHook(() =>
    useActivityLogEmitter({
      documentId: 'doc',
      selfParticipant: { id: 'me', name: 'Me', color: '#123456' },
      setChangeLog: (next) => {
        log = typeof next === 'function' ? next(log) : next;
      },
      entryHistoryRef: { current: emptyEntryHistory() },
      sessionShareCode: null,
      roomRef: { current: { send } },
      changeLogRef: { current: [] },
    }),
  );
  return { emit: result.current, log: () => log, send };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('logging a change too large to store', () => {
  it('logs a summary entry everywhere the entry goes', async () => {
    api.apiAppendChangeLogEntry.mockResolvedValue(undefined);
    const h = harness();
    const added: Element[] = Array.from({ length: 1000 }, (_, i) => text(i));
    act(() => h.emit.emitChange('tab', [], added));
    const [sent] = api.apiAppendChangeLogEntry.mock.calls[0]!.slice(2) as [ChangeLogEntry];
    expect(sent).toMatchObject({ kind: 'add', elementIds: [], beforeState: {}, afterState: {} });
    expect(sent.summary).toMatch(/1,?000/);
    expect(h.log()[0]).toEqual(sent);
    expect(h.send).toHaveBeenCalledWith({ kind: 'op', op: { kind: 'log', entry: sent } });
  });

  it('keeps an ordinary change revertable', () => {
    api.apiAppendChangeLogEntry.mockResolvedValue(undefined);
    const h = harness();
    act(() => h.emit.emitChange('tab', [], [text(1)]));
    const [sent] = api.apiAppendChangeLogEntry.mock.calls[0]!.slice(2) as [ChangeLogEntry];
    expect(sent.elementIds).toEqual(['t-1']);
  });
});

describe('a failed append', () => {
  it('is logged with the entry id, not swallowed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiAppendChangeLogEntry.mockRejectedValue(new Error('append change log: 413'));
    const h = harness();
    act(() => h.emit.emitChange('tab', [], [text(1)]));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        '[activity-log] append failed',
        expect.objectContaining({ id: h.log()[0]!.id }),
      ),
    );
  });
});
