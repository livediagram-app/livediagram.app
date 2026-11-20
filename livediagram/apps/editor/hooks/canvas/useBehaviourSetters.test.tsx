// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Tab } from '@livediagram/document';
import { useBehaviourSetters } from './useBehaviourSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const cover = { ...createShape('reveal', 0, 0), id: 'cover' };
const button = { ...createShape('session-button', 0, 0), id: 'button' };
const tabs = [{ id: 't1', elements: [cover, button] } as unknown as Tab];

const setters = (sessionToolsBlocked: boolean) => {
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    useBehaviourSetters({
      currentSelectionIds: () => new Set(['cover', 'button']),
      contextTargetId: null,
      commitTabs,
      tabs,
      activeId: 't1',
      sessionToolsBlocked,
    }),
  );
  return { ...result.current, commitTabs };
};

// docs/specs/012-collaboration/facilitator.md "What the facilitator runs"
describe('useBehaviourSetters under a facilitator', () => {
  it('reveals a cover for all and configures a session button with nobody facilitating', () => {
    const s = setters(false);
    s.setRevealedSelected(true);
    s.setSessionConfigSelected({ tool: 'timer' });
    expect(s.commitTabs).toHaveBeenCalledTimes(2);
  });

  it('refuses both while somebody else holds the baton', () => {
    const s = setters(true);
    s.setRevealedSelected(true);
    s.setSessionConfigSelected({ tool: 'timer' });
    expect(s.commitTabs).not.toHaveBeenCalled();
  });
});

describe('useBehaviourSetters patches', () => {
  const picker = { ...createShape('picker', 0, 0), id: 'picker' };
  const pad = { ...createShape('reaction-pad', 0, 0), id: 'pad' };
  const other = { ...createShape('square', 0, 0), id: 'other' };
  const twoTabs = [
    { id: 't1', elements: [picker, pad, other] },
    { id: 't2', elements: [{ ...picker, id: 'far' }] },
  ] as unknown as Tab[];
  const run = (selected: string[], contextTargetId: string | null) => {
    const commitTabs = vi.fn();
    const { result } = renderHook(() =>
      useBehaviourSetters({
        currentSelectionIds: () => new Set(selected),
        contextTargetId,
        commitTabs,
        tabs: twoTabs,
        activeId: 't1',
        sessionToolsBlocked: false,
      }),
    );
    const applied = () => (commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[])(twoTabs);
    return { ...result.current, commitTabs, applied };
  };

  it("writes a picker's source and options and a pad's reaction to the menu's target only, on the active tab", () => {
    const s = run([], 'picker');
    s.setPickerSourceSelected('options');
    const [t1, t2] = s.applied();
    expect(t1!.elements.find((e) => e.id === 'picker')).toMatchObject({ pickerSource: 'options' });
    expect(t1!.elements.find((e) => e.id === 'other')).toBe(other);
    expect(t2).toBe(twoTabs[1]);
    const o = run(['picker'], null);
    o.setPickerOptionsSelected(['A', 'B']);
    expect(o.applied()[0]!.elements.find((e) => e.id === 'picker')).toMatchObject({
      pickerOptions: ['A', 'B'],
    });
    const r = run(['pad'], null);
    r.setReactionSelected('hearts');
    expect(r.applied()[0]!.elements.find((e) => e.id === 'pad')).toMatchObject({
      reaction: 'hearts',
    });
  });

  it('commits nothing when no element of that kind is targeted', () => {
    const s = run(['other'], null);
    s.setPickerSourceSelected('options');
    s.setReactionSelected('hearts');
    expect(s.commitTabs).not.toHaveBeenCalled();
  });
});
