import { describe, expect, it } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/diagram';
import {
  portalExitPoint,
  portalName,
  portalsOnTab,
  resolvePortalTarget,
  viewportOffsetCentredOn,
} from './portals';

const portal = (id: string, over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('portal', 0, 0),
  id,
  ...over,
});

describe('portalsOnTab', () => {
  it('picks out the portals and nothing else, in element order', () => {
    const els: Element[] = [
      createShape('square', 0, 0),
      portal('a'),
      createShape('mode-button', 0, 0),
      portal('b'),
    ];
    expect(portalsOnTab(els).map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('portalName', () => {
  it('uses the portal’s own label when it has one', () => {
    const els = [portal('a', { label: 'Kitchen' })];
    expect(portalName(els, els[0]!)).toBe('Kitchen');
  });

  it('falls back to a positional name so an unlabelled pair is tellable apart', () => {
    const els = [portal('a', { label: '   ' }), portal('b', { label: '' })];
    expect(portalName(els, els[0]!)).toBe('Portal 1');
    expect(portalName(els, els[1]!)).toBe('Portal 2');
  });
});

describe('resolvePortalTarget', () => {
  it('finds the paired portal', () => {
    const els = [portal('a', { portalTarget: 'b' }), portal('b')];
    expect(resolvePortalTarget(els, els[0]!)?.id).toBe('b');
  });

  it('treats an unpaired portal as unpaired', () => {
    const els = [portal('a')];
    expect(resolvePortalTarget(els, els[0]!)).toBeNull();
  });

  it('survives a deleted target (a normal mid-edit state, not corruption)', () => {
    const els = [portal('a', { portalTarget: 'gone' })];
    expect(resolvePortalTarget(els, els[0]!)).toBeNull();
  });

  it('refuses a target that is not a portal any more', () => {
    const els: Element[] = [
      portal('a', { portalTarget: 'b' }),
      { ...createShape('square', 0, 0), id: 'b' },
    ];
    expect(resolvePortalTarget(els, els[0]! as ShapeElement)).toBeNull();
  });

  it('refuses to pair a portal with itself', () => {
    const els = [portal('a', { portalTarget: 'a' })];
    expect(resolvePortalTarget(els, els[0]!)).toBeNull();
  });

  it('leads back down an INCOMING link, so a one-sided pairing still returns', () => {
    // A only points at B; walking into B must still come out at A.
    const els = [portal('a', { portalTarget: 'b' }), portal('b')];
    expect(resolvePortalTarget(els, els[1]!)?.id).toBe('a');
  });

  it('prefers a portal’s own target over one pointing at it', () => {
    const els = [
      portal('a', { portalTarget: 'b' }),
      portal('b', { portalTarget: 'c' }),
      portal('c'),
    ];
    expect(resolvePortalTarget(els, els[1]!)?.id).toBe('c');
  });
});

describe('portalExitPoint', () => {
  it('puts you centred in the portalway, on its threshold', () => {
    // The avatar's position is its FEET, so the exit is the bottom edge.
    expect(portalExitPoint({ x: 100, y: 200, width: 72, height: 112 })).toEqual({
      x: 136,
      y: 312,
    });
  });
});

describe('viewportOffsetCentredOn', () => {
  it('centres the portal in the viewport', () => {
    const offset = viewportOffsetCentredOn(
      { x: 500, y: 300, width: 100, height: 100 },
      { width: 1000, height: 800 },
      1,
    );
    // Portal centre (550, 350) lands at the viewport centre (500, 400).
    expect(offset).toEqual({ x: -50, y: 50 });
  });

  it('accounts for zoom, since the offset is applied before the scale', () => {
    const offset = viewportOffsetCentredOn(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 1000, height: 800 },
      2,
    );
    expect(offset).toEqual({ x: 200, y: 150 });
  });
});
