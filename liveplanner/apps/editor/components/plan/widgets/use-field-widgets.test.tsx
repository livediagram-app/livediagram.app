// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  presetSetup,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { PlanProvider } from '../PlanContext';
import { useFieldWidgets } from './use-field-widgets';
import { SeenContext, useSeen, useSeenRoot } from './use-seen';

// docs/specs/026-plan/board-widgets.md "Field widgets" and "Previews are drawn as they come into view".
afterEach(cleanup);

const budget = { id: 'f-budget', label: 'Budget', kind: 'currency' } as CustomFieldDef;
const kids = {
  id: 'f-kids',
  label: 'Kids',
  kind: 'calculated',
  calculation: 'childCount',
} as CustomFieldDef;
const type = (custom: CustomFieldDef[]): ItemTypeDef => ({
  id: 'feature',
  label: 'Feature',
  newTitle: 'New',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', ...custom.map((c) => c.id)],
  custom,
});
const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: ['feature'] };
const NOW = new Date(2026, 9, 10, 12);
const item = {
  id: 'i1',
  type: 'feature',
  key: 1,
  rank: 'a',
  fields: { status: 'todo', 'f-budget': 5 },
} as unknown as Item;

describe('useFieldWidgets', () => {
  it('names built-in, field, changed and removed widgets, and suggests on demand', () => {
    const types = [type([budget])];
    const { result } = renderHook(() =>
      useFieldWidgets({ setup, items: [item], types, widgets: [], now: NOW }),
    );
    const { labelOf, suggest, fields, read } = result.current;
    expect(fields.map((f) => f.def.id)).toEqual(['f-budget']);
    expect(read).toBeUndefined();
    expect(labelOf('progress')).toBe('Completion');
    expect(labelOf('field:sum:f-budget')).toBe('Budget Sum');
    expect(labelOf('field:breakdown:f-budget')).toBe('Budget Breakdown');
    expect(labelOf('field:average:f-gone')).toBe('Removed field Average');
    expect(labelOf('nonsense' as never)).toBe('Widget');
    expect(suggest()[0]?.id).toBe('field:sum:f-budget');
  });

  // board-widgets.md "A field gone": a field made a kind no view reads (Text) has changed kind, not been removed.
  it('names a widget whose field became Text as changed, not removed', () => {
    const notes = { id: 'f-budget', label: 'Budget', kind: 'text' } as CustomFieldDef;
    const { result } = renderHook(() =>
      useFieldWidgets({ setup, items: [item], types: [type([notes])], widgets: [], now: NOW }),
    );
    expect(result.current.fields).toEqual([]);
    expect(result.current.everyField.map((f) => f.def.id)).toEqual(['f-budget']);
    expect(result.current.labelOf('field:sum:f-budget')).toBe('Budget Sum');
  });

  it('keeps the fields while the board’s types stand, and reads Calculated fields through the plan', () => {
    const types = [type([budget, kids])];
    const plan = {
      items: new Map([[item.id, item]]),
      types,
      statusPhases: new Map([['todo', 'todo' as const]]),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PlanProvider value={plan as never}>{children}</PlanProvider>
    );
    const { result, rerender } = renderHook(
      ({ widgets }) => useFieldWidgets({ setup, items: [item], types, widgets, now: NOW }),
      { wrapper, initialProps: { widgets: [] as string[] } as never },
    );
    const before = result.current.fields;
    expect(typeof result.current.read).toBe('function');
    rerender({ widgets: ['progress'] } as never);
    expect(result.current.fields).toBe(before);
  });
});

describe('useSeen', () => {
  it('counts every tile seen without an IntersectionObserver', () => {
    const { result } = renderHook(() => useSeen());
    expect(result.current[1]).toBe(true);
  });

  it('draws a tile once the shared observer sees it, and stops watching it', () => {
    let fire: (entries: { isIntersecting: boolean; target: Element }[]) => void = () => {};
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof fire) {
          fire = cb;
        }
        observe = observe;
        unobserve = unobserve;
        disconnect = disconnect;
      },
    );
    function Tile({ name }: { name: string }) {
      const [ref, seen] = useSeen();
      return (
        <div ref={ref} data-tile={name}>
          {seen ? 'drawn' : 'waiting'}
        </div>
      );
    }
    function List() {
      const root = { current: null };
      const watch = useSeenRoot(root);
      return (
        <SeenContext.Provider value={watch}>
          <Tile name="a" />
          <Tile name="b" />
        </SeenContext.Provider>
      );
    }
    const view = render(<List />);
    expect(observe).toHaveBeenCalledTimes(2);
    const a = view.container.querySelector('[data-tile="a"]')!;
    const b = view.container.querySelector('[data-tile="b"]')!;
    act(() =>
      fire([
        { isIntersecting: false, target: b },
        { isIntersecting: true, target: a },
      ]),
    );
    expect(a.textContent).toBe('drawn');
    expect(b.textContent).toBe('waiting');
    expect(unobserve).toHaveBeenCalledWith(a);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
