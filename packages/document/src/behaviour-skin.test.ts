import { describe, expect, it } from 'vitest';
import { ownColours } from './behaviour-skin';
import { defaultFillColor, defaultStrokeColor, defaultTextColor } from './colors';
import { createShape } from './shape-factory';
import type { ShapeElement, ShapeKind } from './index';

// The control-like Behaviour elements store no colour and follow the surface
// (docs/specs/009-elements/mode-button.md, behaviour-skin.ts).
const KINDS: ShapeKind[] = ['mode-button', 'session-button', 'picker', 'reveal', 'chair'];
const resolved = (el: ShapeElement, surface: 'light' | 'dark') => {
  const own = ownColours(el);
  return {
    fill: own.fill ?? defaultFillColor(el, surface),
    stroke: own.stroke ?? defaultStrokeColor(el, surface),
    text: own.text ?? defaultTextColor(el, surface),
  };
};

describe('Behaviour element skins', () => {
  it('are created with no stored colour', () => {
    for (const kind of KINDS) {
      const el = createShape(kind, 0, 0);
      expect([el.fillColor, el.strokeColor, el.textColor], kind).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    }
  });

  it('resolve light ink on dark paper and dark ink on light paper', () => {
    for (const kind of KINDS) {
      const el = createShape(kind, 0, 0);
      expect(resolved(el, 'light').text, kind).toBe('#0f172a');
      expect(resolved(el, 'dark').text, kind).not.toBe('#0f172a');
    }
    const timer = createShape('session-button', 0, 0);
    expect(resolved(timer, 'light').fill).toBe('#ffffff');
    expect(resolved(timer, 'dark').fill).not.toBe('#ffffff');
  });

  it('treat the skin an element was once created with as unset', () => {
    const old = {
      ...createShape('session-button', 0, 0),
      fillColor: '#ffffff',
      strokeColor: '#cbd5e1',
      textColor: '#0f172a',
    };
    expect(ownColours(old)).toEqual({ fill: undefined, stroke: undefined, text: undefined });
    expect(resolved(old, 'dark').fill).not.toBe('#ffffff');
    const chair = { ...createShape('chair', 0, 0), strokeColor: '#94a3b8', textColor: '#0f172a' };
    expect(ownColours(chair).text).toBeUndefined();
  });

  it('keep a colour the author picked', () => {
    const red = { ...createShape('session-button', 0, 0), fillColor: '#ef4444' };
    expect(ownColours(red).fill).toBe('#ef4444');
    const almost = {
      ...createShape('picker', 0, 0),
      fillColor: '#ffffff',
      strokeColor: '#cbd5e1',
      textColor: '#111111',
    };
    expect(ownColours(almost)).toEqual({ fill: '#ffffff', stroke: '#cbd5e1', text: '#111111' });
  });
});
