// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/document';
import { track } from '@/lib/telemetry';
import { useSnapColours } from './useSnapColours';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const stroke = (id: string, strokeColor?: string): Element => ({
  id,
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  packedPoints: 'AQA=',
  closed: false,
  penWidth: 1.5,
  ...(strokeColor ? { strokeColor } : {}),
});

function setup(elements: Element[], over: { inertIds?: Set<string>; editsBlocked?: boolean } = {}) {
  let live = elements;
  const commit = vi.fn((map: (els: Element[]) => Element[]) => {
    live = map(live);
  });
  const hook = renderHook(() =>
    useSnapColours({
      elements,
      inertIds: over.inertIds ?? new Set(),
      editsBlocked: over.editsBlocked ?? false,
      commit,
    }),
  );
  return { hook, commit, live: () => live };
}

afterEach(() => vi.mocked(track).mockClear());

// docs/specs/023-draw-mode/draw-mode.md "Snap colours".
describe('useSnapColours', () => {
  it('lists the snappable custom colours, leaving protected layers out', () => {
    const { hook } = setup([stroke('a', '#e03131'), stroke('b', '#1971c2'), stroke('c')], {
      inertIds: new Set(['b']),
    });
    expect(hook.result.current.colours).toEqual(['#e03131']);
    expect(hook.result.current.blocked).toBe(false);
  });

  it('snaps every custom colour in one commit, reports it once and returns the count', () => {
    const { hook, commit, live } = setup([stroke('a', '#e03131'), stroke('b', '#868e96')]);
    expect(hook.result.current.snap()).toBe(2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(live()).toEqual([{ ...stroke('a'), penColour: 'red' }, stroke('b')]);
    expect(track).toHaveBeenCalledExactlyOnceWith('Draw', 'Changed', 'SnapColours');
  });

  it('returns the count and reports it even when the commit runs later', () => {
    const elements = [stroke('a', '#e03131'), stroke('b', '#868e96')];
    const later: ((els: Element[]) => Element[])[] = [];
    const hook = renderHook(() =>
      useSnapColours({
        elements,
        inertIds: new Set(),
        editsBlocked: false,
        commit: (map) => void later.push(map),
      }),
    );
    expect(hook.result.current.snap()).toBe(2);
    expect(track).toHaveBeenCalledExactlyOnceWith('Draw', 'Changed', 'SnapColours');
    expect(later[0]!(elements)).toEqual([{ ...stroke('a'), penColour: 'red' }, stroke('b')]);
  });

  it('does nothing while edits are blocked or with nothing to snap', () => {
    const blocked = setup([stroke('a', '#e03131')], { editsBlocked: true });
    expect(blocked.hook.result.current.blocked).toBe(true);
    expect(blocked.hook.result.current.snap()).toBe(0);
    const empty = setup([stroke('a')]);
    expect(empty.hook.result.current.snap()).toBe(0);
    expect(blocked.commit).not.toHaveBeenCalled();
    expect(empty.commit).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
