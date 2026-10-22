// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement, type Tab } from '@liveplanner/document';
import { usePortalTravel, type PortalTravelDeps } from './portal-travel';

// Going through a portal (docs/specs/009-elements/portal-element.md) does two things that have to happen
// together: switch tab when the far portal is on another one, and centre the camera on it.

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
  const { result } = renderHook(() =>
    usePortalTravel({
      elements: [],
      activeTabId: 't1',
      onFollowLink,
      mainRef: viewport as unknown as PortalTravelDeps['mainRef'],
      readZoom: () => 1,
      setViewportOffset,
      ...over,
    }),
  );
  const travel = result.current;
  return { travel, onFollowLink, setViewportOffset };
}

describe('usePortalTravel', () => {
  it('switches tab first when the far portal is on another one', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, onFollowLink, setViewportOffset } = setup({
      elements: [here],
      tabs: [tabOf('t1', [here]), tabOf('t2', [there])],
    });
    travel.enterPortal(here);
    expect(onFollowLink).toHaveBeenCalledWith({ kind: 'tab', tabId: 't2' });
    // And still lands: the tab switch replaces the elements, it doesn't abort.
    expect(setViewportOffset).toHaveBeenCalledTimes(1);
  });

  it('does not switch tab when the far portal is on this one', () => {
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, onFollowLink, setViewportOffset } = setup({
      elements: [here, there],
      tabs: [tabOf('t1', [here, there])],
    });
    travel.enterPortal(here);
    expect(onFollowLink).not.toHaveBeenCalled();
    expect(setViewportOffset).toHaveBeenCalledTimes(1);
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
    const { travel, onFollowLink, setViewportOffset } = setup({ elements: [lonely] });
    travel.enterPortal(lonely);
    expect(onFollowLink).not.toHaveBeenCalled();
    expect(setViewportOffset).not.toHaveBeenCalled();
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
    // camera move is skipped rather than throwing.
    const here = portal('a', { portalTarget: 'b' });
    const there = portal('b');
    const { travel, setViewportOffset } = setup({
      elements: [here, there],
      mainRef: (() => {}) as unknown as PortalTravelDeps['mainRef'],
    });
    expect(() => travel.enterPortal(here)).not.toThrow();
    expect(setViewportOffset).not.toHaveBeenCalled();
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
      ({ setViewportOffset }) =>
        usePortalTravel({
          elements,
          activeTabId: 't1',
          onFollowLink: vi.fn(),
          mainRef: viewport as unknown as PortalTravelDeps['mainRef'],
          readZoom: () => 1,
          setViewportOffset,
        }),
      { initialProps: { setViewportOffset: first } },
    );
    const resolver = result.current.resolvePortal;
    rerender({ setViewportOffset: second });

    expect(result.current.resolvePortal).toBe(resolver);
    result.current.resolvePortal(here).travel!();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
