// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createArrow, type Element, type StickyElement, type Tab } from '@livedocuments/document';
import { DEFAULT_FORMAT_CONFIG, type FormatMode } from '@liveworkspace/workbench/lib/format-config';
import { useElementHelpers } from './useElementHelpers';

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

// A row of three 200x200 notes with 72 gaps.
const note = (id: string, x: number): StickyElement => ({
  id,
  type: 'sticky',
  x,
  y: 0,
  width: 200,
  height: 200,
});
const ROW: Element[] = [note('a', 0), note('b', 272), note('c', 544)];

function harness(elements: Element[] = ROW) {
  const tab: Tab = { id: 't1', name: 'Tab 1', elements };
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    useElementHelpers({
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeId: 't1',
      activeTab: tab,
      editsBlocked: false,
      formatSourceId: null,
      formatConfig: { mode: 'keep', groups: {} } as never,
      commit: vi.fn(),
      commitTabs,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
    }),
  );
  return { helpers: result.current, commitTabs, tab };
}

describe('addBoxedAt', () => {
  it('appends the element, centred on the point, in one commit', () => {
    const { helpers, commitTabs } = harness();
    helpers.addBoxedAt(372, 100, (x) => note('new', x));
    expect(commitTabs).toHaveBeenCalledTimes(1);
    const updater = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const next = updater([{ id: 't1', name: 'Tab 1', elements: ROW }]);
    expect(next[0]!.elements.map((el) => el.id)).toEqual(['a', 'b', 'c', 'new']);
    expect((next[0]!.elements[3] as StickyElement).x).toBe(272);
  });
});

describe('applyFormatFromSource', () => {
  function paintHarness(mode: FormatMode, source = 'a') {
    const line: Element = { ...createArrow(0, 0, 10, 0), id: 'line' };
    const tab: Tab = { id: 't1', name: 'Tab 1', elements: [...ROW, line] };
    const commit = vi.fn();
    const setFormatSourceId = vi.fn();
    const { result } = renderHook(() =>
      useElementHelpers({
        readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
        activeId: 't1',
        activeTab: tab,
        editsBlocked: false,
        formatSourceId: source,
        formatConfig: { ...DEFAULT_FORMAT_CONFIG, mode },
        commit,
        commitTabs: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setFormatSourceId,
      }),
    );
    return { paint: result.current.applyFormatFromSource, commit, setFormatSourceId };
  }

  it('keeps the brush loaded in Keep painting', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('keep');
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(setFormatSourceId).not.toHaveBeenCalled();
  });

  it('empties the brush after one paint in Paint once', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('once');
    paint('b');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(setFormatSourceId).toHaveBeenCalledWith(null);
  });

  it('keeps a Paint once brush loaded on a tap that paints nothing', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('once');
    telemetry.track.mockClear();
    paint('a'); // the source itself
    paint('line'); // the other kind: a note's look onto an arrow
    expect(commit).not.toHaveBeenCalled();
    expect(setFormatSourceId).not.toHaveBeenCalled();
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  it('empties the brush once its source is gone', () => {
    const { paint, commit, setFormatSourceId } = paintHarness('keep', 'deleted');
    paint('b');
    expect(commit).not.toHaveBeenCalled();
    expect(setFormatSourceId).toHaveBeenCalledWith(null);
  });
});
