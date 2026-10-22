// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import {
  createFlowchartStart,
  flowchartConnectors,
  type ArrowElement,
  type Element,
  type Tab,
} from '@livedesign/document';
import { resetMindHandoff } from '@/lib/mind-handoff';
import { useFlowchartGrowth } from './useFlowchartGrowth';
import { routeGrowth } from './growth-routing';

// docs/specs/009-elements/flowchart.md: a growth adds the step and its connector with the chart laid out,
// in one commit; it selects the step without opening its editor; Escape on it while empty removes it.

const start = { ...createFlowchartStart(0, 0), id: 'start', flowchartId: 'start' };
const startTab = (): Tab => ({ id: 't', name: 'Flow', elements: [start] });

function setup(opts: { editsBlocked?: boolean } = {}) {
  const setEditingId = vi.fn();
  const setSelectedId = vi.fn();
  const commits = vi.fn();
  const hook = renderHook(() => {
    const [tabs, setTabs] = useState<Tab[]>([startTab()]);
    const api = useFlowchartGrowth({
      editsBlocked: opts.editsBlocked ?? false,
      activeId: 't',
      activeTab: tabs[0]!,
      commitTabs: (update) => {
        commits();
        setTabs(update);
      },
      setSelectedId,
      setEditingId,
      scrollIntoView: () => {},
    });
    return { api, tab: tabs[0]! };
  });
  return { hook, setEditingId, setSelectedId, commits };
}

const grownId = (setSelectedId: ReturnType<typeof vi.fn>) =>
  setSelectedId.mock.calls.at(-1)![0] as string;
const els = (hook: ReturnType<typeof setup>['hook']): Element[] => hook.result.current.tab.elements;

afterEach(() => {
  cleanup();
  resetMindHandoff();
});

describe('useFlowchartGrowth', () => {
  it('grows the next step, connected and laid out, in one commit, selected but not edited', () => {
    const { hook, setEditingId, setSelectedId, commits } = setup();
    act(() => hook.result.current.api.growFlowchartStep('start', 'next'));
    const id = grownId(setSelectedId);
    expect(commits).toHaveBeenCalledTimes(1);
    const step = els(hook).find((e) => e.id === id);
    expect(step).toMatchObject({ shape: 'square', flowchartId: 'start' });
    expect(flowchartConnectors(els(hook), 'start')).toHaveLength(1);
    expect((step as { y: number }).y).toBeGreaterThan(start.y + start.height);
    expect(setEditingId).not.toHaveBeenCalledWith(id);
  });

  it('grows a chosen type, and labels a Decision exit Yes', () => {
    const { hook, setSelectedId } = setup();
    act(() => hook.result.current.api.growFlowchartStep('start', 'next', 'decision'));
    const decision = grownId(setSelectedId);
    act(() => hook.result.current.api.growFlowchartStep(decision, 'next'));
    const exit = flowchartConnectors(els(hook), 'start').find(
      (c) => c.from.kind === 'pinned' && c.from.elementId === decision,
    ) as ArrowElement;
    expect(exit.label).toBe('Yes');
  });

  it('removes the just-grown step on Escape while it is still empty, back to its source', () => {
    const { hook, setSelectedId } = setup();
    act(() => hook.result.current.api.growFlowchartStep('start', 'next'));
    const id = grownId(setSelectedId);
    let removed = false;
    act(() => {
      removed = hook.result.current.api.escapeGrownFlowchartStep(id);
    });
    expect(removed).toBe(true);
    expect(els(hook).map((e) => e.id)).toEqual(['start']);
    expect(setSelectedId).toHaveBeenLastCalledWith('start');
  });

  it('never removes the start or a labelled step on Escape', () => {
    const { hook } = setup();
    expect(hook.result.current.api.escapeGrownFlowchartStep('start')).toBe(false);
    expect(hook.result.current.api.abandonFlowchartStep('start')).toBe(false);
  });

  it('grows nothing while edits are blocked', () => {
    const { hook, commits } = setup({ editsBlocked: true });
    expect(hook.result.current.api.canGrowFlowchartStep('start')).toBe(false);
    act(() => hook.result.current.api.growFlowchartStep('start', 'next'));
    expect(commits).not.toHaveBeenCalled();
  });
});

describe('routeGrowth', () => {
  const mind = {
    canGrowMindNode: (id: string) => id === 'm',
    growMindNode: vi.fn(),
    abandonMindNode: () => false,
    escapeGrownMindNode: () => false,
  };
  const flow = {
    canGrowFlowchartStep: (id: string) => id === 's',
    growFlowchartStep: vi.fn(),
    abandonFlowchartStep: () => true,
    escapeGrownFlowchartStep: () => true,
  };

  it('sends a step to the flowchart, a child to its next step and a sibling to a parallel one', () => {
    const r = routeGrowth(mind, flow);
    expect(r.canGrowMindNode('s')).toBe(true);
    expect(r.canGrowMindNode('x')).toBe(false);
    r.growMindNode('s', 'child');
    r.growMindNode('s', 'sibling');
    expect(flow.growFlowchartStep.mock.calls).toEqual([
      ['s', 'next'],
      ['s', 'parallel'],
    ]);
    r.growMindNode('m', 'child');
    expect(mind.growMindNode).toHaveBeenCalledWith('m', 'child');
    expect(r.abandonMindNode('s')).toBe(true);
    expect(r.escapeGrownMindNode('s')).toBe(true);
  });
});
