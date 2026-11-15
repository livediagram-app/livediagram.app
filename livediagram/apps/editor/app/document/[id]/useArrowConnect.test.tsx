// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ArrowElement, type Element, type Tab } from '@livediagram/document';
import { useArrowConnect } from './useArrowConnect';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// Click-to-connect (docs/specs/008-canvas/canvas-and-palette.md): the arrow it draws off a mind node or a
// flowchart step starts at the exact anchor (docs/specs/008-canvas/arrow-anchors.md).

function connect(from: Element): ArrowElement {
  const to = { ...createShape('square', 400, 0), id: 'to' };
  const first: Tab = { id: 't', name: 'Tab', elements: [from, to] };
  let tabs: Tab[] = [first];
  const { result } = renderHook(() =>
    useArrowConnect({
      editsBlocked: false,
      activeId: 't',
      activeTab: tabs[0]!,
      readSelection: () => ({ selectedId: from.id, multiSelectedIds: new Set<string>() }),
      setSelectedId: vi.fn(),
      beginDraw: vi.fn(),
      commitTabs: (fn) => {
        tabs = fn(tabs);
      },
      styleNewElement: (el) => el,
    }),
  );
  act(() => result.current.addArrow());
  act(() => result.current.connectArrowTo('to'));
  return tabs[0]!.elements.find((e): e is ArrowElement => e.type === 'arrow')!;
}

describe('useArrowConnect', () => {
  it('starts an arrow off a mind node or a flowchart step at the exact anchor', () => {
    const mind = { ...createShape('mind-node', 0, 0), id: 'from' } as Element;
    expect(connect(mind).exactStart).toBe(true);
    const step = { ...createShape('square', 0, 0), id: 'from', flowchartId: 'from' } as Element;
    expect(connect(step).exactStart).toBe(true);
  });

  it('leaves an arrow off a plain box to fan', () => {
    expect(connect({ ...createShape('square', 0, 0), id: 'from' }).exactStart).toBeUndefined();
  });
});
