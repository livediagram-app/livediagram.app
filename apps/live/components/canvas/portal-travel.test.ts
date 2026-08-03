import { describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement, type Tab } from '@livediagram/diagram';
import { makePortalTravel, type PortalTravelDeps } from './portal-travel';

// Going through a portal (spec/104) does three things that have to happen
// together: switch tab when the far portal is on another one, centre the camera
// on it, and step the walking character out of it. They were previously wired
// inline in Canvas, where none of them could be tested without a DOM.

const portal = (id: string, over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('portal', 0, 0),
  id,
  ...over,
});

const tabOf = (id: string, elements: ShapeElement[]): Tab => ({ id, name: id, elements }) as Tab;

// A viewport that measures 800x600, which is all enterPortal reads off it.
const viewport = { current: { getBoundingClientRect: () => ({ width: 800, height: 600 }) } };

function setup(over: Partial<PortalTravelDeps> = {}) {
  const onFollowLink = vi.fn();
  const setViewportOffset = vi.fn();
  const teleportTo = vi.fn();
  const travel = makePortalTravel({
    elements: [],
    activeTabId: 't1',
    onFollowLink,
    mainRef: viewport as unknown as PortalTravelDeps['mainRef'],
    viewportZoom: 1,
    setViewportOffset,
    teleportTo,
    ...over,
  });
  return { travel, onFollowLink, setViewportOffset, teleportTo };
}

describe('makePortalTravel', () => {
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
