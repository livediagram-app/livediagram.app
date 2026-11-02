// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import {
  applyFlowchartStep,
  createFlowchartStart,
  flowchartLanes,
  planFlowchartStep,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livehuddle/document';
import { useFlowchartSetters } from './useFlowchartSetters';

// docs/specs/009-elements/flowchart.md: the Flowchart menu section's and step toolbar's actions, each one commit.

function chart(): Element[] {
  const start = { ...createFlowchartStart(0, 0), id: 'start', flowchartId: 'start' };
  return applyFlowchartStep(
    [start],
    planFlowchartStep([start], 'start', 'next', { step: 'p', connector: 'c' })!,
  );
}

function setup(selected: string[], editsBlocked = false) {
  const notify = vi.fn();
  const commits = vi.fn();
  const hook = renderHook(() => {
    const [tab, setTab] = useState<Tab>({
      id: 't',
      name: 'Flow',
      elements: chart(),
    } as unknown as Tab);
    const api = useFlowchartSetters({
      currentSelectionIds: () => new Set(selected),
      commitActiveTab: (map) => {
        commits();
        setTab(map);
      },
      elements: () => tab.elements,
      editsBlocked,
      notify,
    });
    return { api, tab };
  });
  return { hook, notify, commits };
}

const step = (els: Element[], id: string) => els.find((e) => e.id === id) as ShapeElement;

describe('useFlowchartSetters', () => {
  it('retypes the selected steps in one commit', () => {
    const { hook, commits } = setup(['p']);
    act(() => hook.result.current.api.setStepTypeSelected('decision'));
    expect(step(hook.result.current.tab.elements, 'p').shape).toBe('diamond');
    expect(commits).toHaveBeenCalledTimes(1);
  });

  it('retypes one step by id', () => {
    const { hook } = setup([]);
    act(() => hook.result.current.api.setStepType('p', 'io'));
    expect(step(hook.result.current.tab.elements, 'p').shape).toBe('parallelogram');
  });

  it('turns the chart of the selection, and adds lanes to it', () => {
    const { hook } = setup(['p']);
    act(() => hook.result.current.api.setDirectionSelected('right'));
    expect(step(hook.result.current.tab.elements, 'start').flowDirection).toBe('right');
    act(() => hook.result.current.api.addLaneSelected());
    expect(flowchartLanes(hook.result.current.tab.elements, 'start')).toHaveLength(2);
    const lane = flowchartLanes(hook.result.current.tab.elements, 'start')[1]!;
    act(() => hook.result.current.api.moveToLane('p', lane.id));
    expect(step(hook.result.current.tab.elements, 'p').flowLaneId).toBe(lane.id);
  });

  it('says whether Tidy Flowchart moved anything', () => {
    const { hook, notify } = setup(['start']);
    act(() => hook.result.current.api.tidySelected());
    expect(notify).toHaveBeenLastCalledWith('info', 'Flowchart already tidy');
  });

  it('changes nothing while edits are blocked', () => {
    const { hook, commits } = setup(['p'], true);
    act(() => hook.result.current.api.setStepTypeSelected('decision'));
    act(() => hook.result.current.api.addLaneSelected());
    expect(commits).not.toHaveBeenCalled();
  });
});
