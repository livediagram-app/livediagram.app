// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  libraryLookup,
  type DesignComponent,
  type Element,
  type InstanceElement,
} from '@livedesign/design';

const trackMock = vi.fn<(...a: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: unknown[]) => {
    trackMock(...a);
  },
}));

import { MAKE_COMPONENT_REFUSAL, useComponentActions } from './useComponentActions';
import type { ComponentLibraryState } from './useComponentLibrary';

const box = (id: string, x = 0, y = 0, over: Partial<Element> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 40,
    height: 20,
    label: id,
    ...over,
  }) as Element;

const main: DesignComponent = {
  id: 'm',
  name: 'Component 1',
  width: 40,
  height: 20,
  elements: [box('a')],
  updatedAt: 1,
};

const inst = (over: Partial<InstanceElement> = {}): InstanceElement => ({
  id: 'i',
  type: 'shape',
  shape: 'instance',
  componentId: 'm',
  x: 100,
  y: 100,
  width: 40,
  height: 20,
  ...over,
});

function setup(elements: Element[], canEdit = true, mains: DesignComponent[] = [main]) {
  let current = elements;
  const commit = vi.fn((map: (els: Element[]) => Element[]) => {
    current = map(current);
  });
  const lib = new Map(mains.map((m) => [m.id, m]));
  const library: ComponentLibraryState = {
    library: lib,
    lookup: libraryLookup(lib),
    loaded: true,
    addComponent: vi.fn(() => Promise.resolve()),
    changeComponent: vi.fn(),
    addMissing: vi.fn(),
    receiveComponent: vi.fn(),
  };
  const select = vi.fn();
  let n = 0;
  const { result } = renderHook(() =>
    useComponentActions({
      canEdit,
      selfId: 'me',
      elements,
      commit,
      library,
      select,
      viewCentre: () => ({ x: 500, y: 500 }),
      newId: () => `id${(n += 1)}`,
      now: () => 99,
    }),
  );
  return { actions: result.current, get: () => current, commit, library, select };
}

beforeEach(() => trackMock.mockReset());

describe('useComponentActions', () => {
  it('makes a component from a selection: one instance in its place, the main added, selected', () => {
    const s = setup([box('x', 10, 10), box('y', 60, 10), box('z', 300, 300)], true, []);
    expect(s.actions.makeRefusal(new Set())).toBe('empty');
    expect(MAKE_COMPONENT_REFUSAL.empty).toMatch(/Select/);
    s.actions.makeFromSelection(new Set(['x', 'y']));
    const out = s.get();
    expect(out.map((e) => e.id)).toEqual(['id2', 'z']);
    expect(out[0]).toMatchObject({ shape: 'instance', componentId: 'id1', x: 10, y: 10 });
    expect(s.library.addComponent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id1', name: 'Component 1' }),
    );
    expect(s.select).toHaveBeenCalledWith(['id2']);
    expect(trackMock).toHaveBeenCalledWith('Element', 'Added', 'Component');
  });

  it('refuses a selection it may not make, changing nothing', () => {
    const s = setup([box('x', 0, 0, { locked: true })]);
    s.actions.makeFromSelection(new Set(['x']));
    expect(s.commit).not.toHaveBeenCalled();
  });

  it('places an instance at the view centre, its frame size', () => {
    const s = setup([]);
    s.actions.placeInstance('m');
    expect(s.get()[0]).toMatchObject({ shape: 'instance', x: 480, y: 490, width: 40 });
    s.actions.placeInstance('m', { x: 0, y: 0 });
    expect(s.get()[1]).toMatchObject({ x: -20, y: -10 });
    s.actions.placeInstance('gone');
    expect(s.get()).toHaveLength(2);
    expect(trackMock).toHaveBeenCalledWith('Element', 'Added', 'Instance');
  });

  it('detaches an instance into plain elements with fresh ids', () => {
    const s = setup([inst()]);
    s.actions.detach('i');
    expect(s.get()).toEqual([expect.objectContaining({ id: 'id1-1', shape: 'square', x: 100 })]);
    expect(s.select).toHaveBeenCalledWith(['id1-1']);
    s.actions.detach('missing');
    expect(s.commit).toHaveBeenCalledTimes(1);
  });

  it('sets, clears and resets overrides', () => {
    const s = setup([inst()]);
    s.actions.setOverride('i', 'a', 'label', 'Hi');
    expect((s.get()[0] as InstanceElement).componentOverrides).toEqual({ a: { label: 'Hi' } });
    s.actions.setOverride('i', 'a', 'label', undefined);
    expect(s.get()[0]).not.toHaveProperty('componentOverrides');
    s.actions.setOverride('i', 'a', 'fillColor', '#fff');
    s.actions.resetOverrides('i');
    expect(s.get()[0]).not.toHaveProperty('componentOverrides');
  });

  it('renames and removes a main through the library', () => {
    const s = setup([inst()]);
    s.actions.rename('m', '  Nav  bar ');
    expect(s.library.changeComponent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nav bar', updatedAt: 99 }),
    );
    s.actions.rename('m', 'Component 1');
    s.actions.rename('m', '   ');
    s.actions.rename('gone', 'X');
    expect(s.library.changeComponent).toHaveBeenCalledTimes(1);
    s.actions.removeFromLibrary('m');
    expect(s.library.changeComponent).toHaveBeenLastCalledWith(
      expect.objectContaining({ archived: true }),
    );
    s.actions.removeFromLibrary('gone');
    expect(s.library.changeComponent).toHaveBeenCalledTimes(2);
  });

  it('does not remove a main already removed', () => {
    const s = setup([inst()], true, [{ ...main, archived: true }]);
    s.actions.removeFromLibrary('m');
    expect(s.library.changeComponent).not.toHaveBeenCalled();
  });

  it('opens and closes an edit session, selecting its members then the instance', () => {
    const s = setup([inst()]);
    s.actions.startEdit('i');
    expect(s.get().map((e) => e.id)).toEqual(['i', 'i-a']);
    expect(s.get()[0]).toMatchObject({ componentEditBy: 'me' });
    expect(s.select).toHaveBeenCalledWith(['i-a']);
    s.actions.finishEdit('i');
    expect(s.get().map((e) => e.id)).toEqual(['i']);
    expect(s.select).toHaveBeenLastCalledWith(['i']);
    s.actions.startEdit('nope');
    expect(s.commit).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a Participant or a Viewer', () => {
    const s = setup([box('x'), inst()], false);
    s.actions.makeFromSelection(new Set(['x']));
    s.actions.placeInstance('m');
    s.actions.detach('i');
    s.actions.setOverride('i', 'a', 'label', 'Hi');
    s.actions.resetOverrides('i');
    s.actions.rename('m', 'X');
    s.actions.removeFromLibrary('m');
    s.actions.startEdit('i');
    s.actions.finishEdit('i');
    expect(s.commit).not.toHaveBeenCalled();
    expect(s.library.changeComponent).not.toHaveBeenCalled();
    expect(s.actions.canEdit).toBe(false);
  });
});
