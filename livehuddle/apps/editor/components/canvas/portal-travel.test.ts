// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement, type Tab } from '@livehuddle/document';
import { usePortalBoard, usePortalTravel, type PortalTravelDeps } from './portal-travel';

// Going through a portal (docs/specs/009-elements/portal-element.md) does three things that have to happen
// together: switch tab when the far portal is on another one, centre the camera
// on it, and step the walking character out of it. They were previously wired
// inline in Canvas, where none of them could be tested without a DOM.

const portal = (id: string, over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('portal', 0, 0),
  id,
  ...over,
});

const tabOf = (id: string, elements: ShapeElement[]): Tab => ({ id, name: id, elements });

// A viewport that measures 800x600, which is all enterPortal reads off it.
const viewport = { current: { getBoundingClientRect: () => ({ width: 800, height: 600 }) } };

function setup(over: Partial<PortalTravelDeps> = {}) {
  const onFollowLink = vi.fn();
  const setViewportOffset = vi.fn();
  const teleportTo = vi.fn();
  const { result } = renderHook(() =>
    usePortalTravel({
      elements: [],
      activeTabId: 't1',
      onFollowLink,
      mainRef: viewport as unknown as PortalTravelDeps['mainRef'],
      setViewportOffset,
      teleportTo,
      ...over,
    }),
  );
  const travel = result.current;
  return { travel, onFollowLink, setViewportOffset, teleportTo };
}

describe('usePortalTravel', () => {
  it('switches tab first when the far portal is on another one', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, onFollowLink, teleportTo } = setup({
      elements: [here],
      tabs: [tabOf('t1', [here]), tabOf('t2', [there])],
    });
    travel.enterPortal(here);
    expect(onFollowLink).toHaveBeenCalledWith({ kind: 'tab', tabId: 't2' });
    // And still lands: the tab switch replaces the elements, it doesn't abort.
    expect(teleportTo).toHaveBeenCalledTimes(1);
  });

  it('does not switch tab when the far portal is on this one', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, onFollowLink, teleportTo } = setup({
      elements: [here, there],
      tabs: [tabOf('t1', [here, there])],
    });
    travel.enterPortal(here);
    expect(onFollowLink).not.toHaveBeenCalled();
    expect(teleportTo).toHaveBeenCalledTimes(1);
  });

  it('steps the character out at the far portal’s base, and names it as the one to ignore', () => {
    // Ignoring it matters: a character dropped on top of a portal would
    // otherwise be walked straight back through it.
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b', { x: 100, y: 200, width: 60, height: 40 });
    const { travel, teleportTo } = setup({ elements: [here, there] });
    travel.enterPortal(here);
    expect(teleportTo).toHaveBeenCalledWith({ x: 130, y: 240 }, 'b');
  });

  it('centres the camera on the far portal', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b', { x: 100, y: 200, width: 60, height: 40 });
    const { travel, setViewportOffset } = setup({ elements: [here, there] });
    travel.enterPortal(here);
    expect(setViewportOffset).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all for an unlinked portal', () => {
    const lonely = portal('a');
    const { travel, onFollowLink, setViewportOffset, teleportTo } = setup({ elements: [lonely] });
    travel.enterPortal(lonely);
    expect(onFollowLink).not.toHaveBeenCalled();
    expect(setViewportOffset).not.toHaveBeenCalled();
    expect(teleportTo).not.toHaveBeenCalled();
  });

  it('leaves an unlinked portal’s face inert, with no name and no travel action', () => {
    const lonely = portal('a');
    const { travel } = setup({ elements: [lonely] });
    expect(travel.resolvePortal(lonely)).toEqual({ targetName: null, travel: undefined });
  });

  it('names the far portal for the face, reading the destination tab’s elements', () => {
    // The name comes from the tab the portal is ON. Deliberately UNLABELLED, so
    // the name falls back to a positional one and therefore depends on which
    // element list is read — a labelled portal would return its label either way
    // and prove nothing. `b` is second on its own tab ("Portal 2") and absent
    // from the departure tab, which would name it a bare "Portal".
    const here = portal('a', { portalTarget: 'b' });
    const other = portal('x');
    const there = portal('b');
    const { travel } = setup({
      elements: [here],
      tabs: [tabOf('t1', [here]), tabOf('t2', [other, there])],
    });
    expect(travel.resolvePortal(here).targetName).toBe('Portal 2');
    expect(travel.resolvePortal(here).travel).toBeTypeOf('function');
  });

  it('survives a callback ref, which has no viewport to measure', () => {
    // mainRef is the broad React Ref: a callback ref has no `current`, so the
    // camera move is skipped rather than throwing, and the character still lands.
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, setViewportOffset, teleportTo } = setup({
      elements: [here, there],
      mainRef: (() => {}) as unknown as PortalTravelDeps['mainRef'],
    });
    travel.enterPortal(here);
    expect(setViewportOffset).not.toHaveBeenCalled();
    expect(teleportTo).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/008-canvas/canvas-performance.md: element views take the resolver as a prop, so it keeps
// its identity while the board is unchanged, however often the canvas renders (a zoom, a pan).
describe('usePortalTravel resolver identity', () => {
  it('keeps the same resolver across renders with fresh handlers, and travels with the newest', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const elements = [here, there];
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ teleportTo }) =>
        usePortalTravel({
          elements,
          activeTabId: 't1',
          onFollowLink: vi.fn(),
          mainRef: viewport as unknown as PortalTravelDeps['mainRef'],
          setViewportOffset: vi.fn(),
          teleportTo,
        }),
      { initialProps: { teleportTo: first } },
    );
    const resolver = result.current.resolvePortal;
    rerender({ teleportTo: second });

    expect(result.current.resolvePortal).toBe(resolver);
    result.current.resolvePortal(here).travel!();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

// The board the faces resolve against (docs/specs/008-canvas/blueprints/canvas-performance.md): the resolver goes to
// every element view as a plain prop, so its identity must hold through a drag and move the moment a link is made.
describe('usePortalBoard', () => {
  const a = portal('a');
  const b = portal('b');
  const box = { ...portal('box'), shape: 'chair' } as ShapeElement;

  it('keeps the same board while only positions or other elements change', () => {
    const { result, rerender } = renderHook(
      ({ els }) => usePortalBoard(els, [tabOf('t1', [a, b])]),
      {
        initialProps: { els: [a, b, box] as ShapeElement[] },
      },
    );
    const first = result.current;
    rerender({ els: [{ ...a, x: 300 }, b, { ...box, x: 40, label: 'Moved' }] });
    expect(result.current).toBe(first);
    expect(first.elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(first.tabs?.[0]?.elements.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('mints a new board, in the same render, when a link, a name or a tab changes', () => {
    const { result, rerender } = renderHook(
      ({ els, tabs }: { els: ShapeElement[]; tabs?: Tab[] }) => usePortalBoard(els, tabs),
      { initialProps: { els: [a, b], tabs: [tabOf('t1', [a, b])] as Tab[] | undefined } },
    );
    const first = result.current;
    const linked = [
      { ...a, portalTarget: 'b' },
      { ...b, portalTarget: 'a' },
    ];
    rerender({ els: linked, tabs: [tabOf('t1', linked)] });
    expect(result.current).not.toBe(first);
    expect((result.current.elements[0] as ShapeElement).portalTarget).toBe('b');
    const second = result.current;
    rerender({ els: linked, tabs: [{ ...tabOf('t1', linked), name: 'Lobby' }] });
    expect(result.current).not.toBe(second);
    rerender({ els: linked, tabs: undefined });
    expect(result.current.tabs).toBeUndefined();
  });

  it('resolves a new link at once: the face of the portal it was made from reads it in the same render', () => {
    const setup2 = (elements: ShapeElement[]) =>
      renderHook(
        ({ els }) =>
          usePortalTravel({
            elements: els,
            tabs: [tabOf('t1', els)],
            activeTabId: 't1',
            onFollowLink: vi.fn(),
            setViewportOffset: vi.fn(),
            teleportTo: vi.fn(),
          }),
        { initialProps: { els: elements } },
      );
    const { result, rerender } = setup2([a]);
    expect(result.current.resolvePortal(a).travel).toBeUndefined();
    const created = portal('c', { portalTarget: 'a' });
    const source = { ...a, portalTarget: 'c' };
    rerender({ els: [source, created] });
    expect(result.current.resolvePortal(source).targetName).toBe('Portal 2');
    expect(result.current.resolvePortal(source).travel).toBeTypeOf('function');
  });
});
