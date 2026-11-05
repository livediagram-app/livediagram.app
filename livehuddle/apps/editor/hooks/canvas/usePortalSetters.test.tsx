// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type ShapeElement, type Tab } from '@livehuddle/document';
import { usePortalSetters } from './usePortalSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const pad = { ...createShape('reaction-pad', 0, 0), id: 'pad' };
const square = { ...createShape('square', 0, 0), id: 'square' };
const tabs = [{ id: 't1', elements: [pad, square] } as unknown as Tab];

const setters = (selected: string[]) => {
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    usePortalSetters({
      currentSelectionIds: () => new Set(selected),
      contextTargetId: null,
      commitTabs,
      tabs,
      activeId: 't1',
      setSelectedId: vi.fn(),
    }),
  );
  return { ...result.current, commitTabs };
};

// docs/specs/009-elements/reaction-pad.md: which burst a pad throws.
describe('usePortalSetters: reaction pad', () => {
  it('sets the burst on the selected pad and nothing else', () => {
    const s = setters(['pad', 'square']);
    s.setReactionSelected('hearts');
    expect(s.commitTabs).toHaveBeenCalledTimes(1);
    const map = s.commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    const next = map(tabs);
    const [nextPad, nextSquare] = next[0]!.elements as ShapeElement[];
    expect(nextPad!.reaction).toBe('hearts');
    expect(nextSquare).toBe(square);
  });

  it('writes nothing when no pad is selected', () => {
    const s = setters(['square']);
    s.setReactionSelected('hearts');
    expect(s.commitTabs).not.toHaveBeenCalled();
  });
});
