import { describe, expect, it } from 'vitest';
import {
  applyOverride,
  componentOverrideTargets,
  expandInstances,
  instanceScale,
  missingComponentFrame,
  resolveInstance,
  resolvedElementId,
  withOverride,
} from './component-resolve';
import { arrow, box, instanceOf, navMain, text } from './components.test.fixtures';
import type { DesignComponent } from './components';
import type { ArrowElement, Element, ShapeElement } from './index';
import { svgBoxed } from './svg-render';

describe('resolveInstance', () => {
  it('places the main at the instance, ids namespaced', () => {
    const main = navMain();
    const out = resolveInstance(instanceOf(main), main);
    expect(out.map((e) => e.id)).toEqual(['inst/bar', 'inst/brand', 'inst/icon']);
    expect(out[0]).toMatchObject({ x: 100, y: 50, width: 200, height: 40 });
    expect(out[1]).toMatchObject({ x: 110, y: 60, label: 'Acme' });
  });

  it('scales positions and sizes with the instance box', () => {
    const main = navMain();
    const out = resolveInstance(instanceOf(main, { width: 400, height: 80 }), main);
    expect(out[2]).toMatchObject({ x: 100 + 340, y: 50 + 20, width: 40, height: 40 });
    expect(instanceScale({ width: 5, height: 5 }, { ...main, width: 0, height: 0 })).toEqual({
      sx: 1,
      sy: 1,
    });
  });

  it('applies overrides, and leaves the main alone when told to', () => {
    const main = navMain();
    const inst = instanceOf(main, {
      componentOverrides: {
        brand: { label: 'Shop', textColor: '#ff0000' },
        bar: { fillColor: '#00ff00', strokeColor: '#0000ff' },
        icon: { iconId: 'cart' },
      },
    });
    const [bar, brand, icon] = resolveInstance(inst, main) as ShapeElement[];
    expect(brand).toMatchObject({ label: 'Shop', textColor: '#ff0000' });
    expect(brand).not.toHaveProperty('textSwatch');
    expect(bar).toMatchObject({ fillColor: '#00ff00', strokeColor: '#0000ff' });
    expect(bar).not.toHaveProperty('colorPreset');
    expect(icon!.iconId).toBe('cart');
    const plain = resolveInstance(inst, main, { overrides: false }) as ShapeElement[];
    expect(plain[1]!.label).toBe('Acme');
  });

  it('carries the instance layer, opacity and rotation (exports)', () => {
    const main = navMain();
    const inst = instanceOf(main, { layerId: 'L1', opacity: 0.5, rotation: 90 });
    const out = resolveInstance(inst, main, { rotate: true }) as ShapeElement[];
    expect(out.every((e) => e.layerId === 'L1' && e.opacity === 0.5 && e.rotation === 90)).toBe(
      true,
    );
    // The bar spans the whole instance, so its centre stays put under the turn.
    expect(out[0]!.x + out[0]!.width / 2).toBeCloseTo(200);
    expect(out[0]!.y + out[0]!.height / 2).toBeCloseTo(70);
    const flat = resolveInstance(inst, main) as ShapeElement[];
    expect(flat[0]).not.toHaveProperty('rotation');
  });

  it('maps arrow ends, bends and attached hosts', () => {
    const main: DesignComponent = {
      ...navMain(),
      elements: [
        box('a', 0, 0),
        box('b', 100, 0),
        { ...box('chip', 0, 0, 10, 10), attachedTo: 'a' },
        {
          ...arrow(
            'ar',
            { kind: 'pinned', elementId: 'a', anchor: 'e' },
            { kind: 'free', x: 10, y: 10 },
          ),
          curveOffset: { dx: 2, dy: 2 },
          elbowOffset: { dx: 1, dy: 1 },
          curvePoints: [{ dx: 4, dy: 4 }],
        },
        arrow(
          'ar2',
          { kind: 'on-arrow', arrowId: 'ar', t: 0.5 },
          { kind: 'pinned', elementId: 'b', anchor: 'w' },
        ),
      ],
    };
    const out = resolveInstance(instanceOf(main, { width: 400, height: 80, layerId: 'L' }), main);
    const ar = out[3] as ArrowElement;
    expect(ar.from).toEqual({ kind: 'pinned', elementId: 'inst/a', anchor: 'e' });
    expect(ar.to).toEqual({ kind: 'free', x: 120, y: 70 });
    expect(ar.curveOffset).toEqual({ dx: 4, dy: 4 });
    expect(ar.elbowOffset).toEqual({ dx: 2, dy: 2 });
    expect(ar.curvePoints).toEqual([{ dx: 8, dy: 8 }]);
    expect(ar.layerId).toBe('L');
    expect((out[4] as ArrowElement).from).toEqual({ kind: 'on-arrow', arrowId: 'inst/ar', t: 0.5 });
    expect((out[2] as { attachedTo?: string }).attachedTo).toBe('inst/a');
    const noLayer = resolveInstance(instanceOf(main), main);
    expect(noLayer[3]).not.toHaveProperty('layerId');
  });

  it('drops what belongs to the authored element', () => {
    const main = {
      ...navMain(),
      elements: [
        box('a', 0, 0, 10, 10, {
          addedBy: 'p',
          componentMember: { instanceId: 'x', elementId: 'a' },
        }),
      ],
    };
    const [a] = resolveInstance(instanceOf(main), main);
    expect(a).not.toHaveProperty('addedBy');
    expect(a).not.toHaveProperty('componentMember');
    expect(resolvedElementId('i', 'e')).toBe('i/e');
  });
});

describe('applyOverride', () => {
  it('changes nothing without an override, and swaps an icon only where there is one', () => {
    const el = box('a', 0, 0);
    expect(applyOverride(el, undefined)).toBe(el);
    expect(applyOverride(el, {})).toBe(el);
    expect(applyOverride(el, { iconId: 'x' })).toBe(el);
    expect(applyOverride(text('t', 0, 0, 'Hi'), { label: 'Yo' }).label).toBe('Yo');
  });
});

describe('expandInstances', () => {
  const main = navMain();
  const lookup = (id: string) => (id === main.id ? main : undefined);

  it('returns the tab itself when it holds no instance', () => {
    const tab = { elements: [box('a', 0, 0)] };
    expect(expandInstances(tab, lookup)).toBe(tab);
  });

  it('keeps the instance as an anchor followed by its elements, turned', () => {
    const tab = {
      id: 't',
      elements: [box('a', 0, 0), instanceOf(main, { rotation: 0 }), box('z', 0, 0)],
    };
    const out = expandInstances(tab, lookup);
    expect(out.elements.map((e) => e.id)).toEqual([
      'a',
      'inst',
      'inst/bar',
      'inst/brand',
      'inst/icon',
      'z',
    ]);
    expect(out).toMatchObject({ id: 't' });
    expect(out.elements[1]).toMatchObject({ id: 'inst', opacity: 0 });
    // A second pass changes nothing.
    expect(expandInstances(out, lookup)).toBe(out);
  });

  it('drops an instance in an edit session and draws a missing main as a dashed frame', () => {
    const tab = {
      elements: [
        instanceOf(main, { componentEditBy: 'me' }),
        instanceOf(main, { id: 'gone', componentId: 'nope', layerId: 'L', rotation: 10 }),
        { ...instanceOf(main, { id: 'bare' }), componentId: undefined } as unknown as Element,
      ],
    };
    const out = expandInstances(tab, lookup);
    expect(out.elements.map((e) => e.id)).toEqual(['gone', 'bare']);
    expect(out.elements[0]).toMatchObject({
      shape: 'square',
      label: 'Missing component',
      strokeStyle: 'dashed',
      layerId: 'L',
      rotation: 10,
    });
    expect(missingComponentFrame(instanceOf(main))).not.toHaveProperty('layerId');
  });
});

describe('overrides', () => {
  it('lists the main elements that take one, named by their text or kind', () => {
    const main: DesignComponent = {
      ...navMain(),
      elements: [
        ...navMain().elements,
        arrow('ar', { kind: 'free', x: 0, y: 0 }, { kind: 'free', x: 1, y: 1 }),
        {
          id: 'd',
          type: 'freehand',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          closed: false,
          packedPoints: '',
        },
      ],
    };
    const targets = componentOverrideTargets(main);
    expect(targets.map((t) => [t.elementId, t.name, t.fields])).toEqual([
      ['bar', 'Shape', ['fillColor', 'strokeColor']],
      ['brand', 'Acme', ['label', 'textColor']],
      ['icon', 'Icon', ['strokeColor', 'iconId']],
      ['ar', 'Arrow', ['strokeColor']],
      ['d', 'Drawing', ['fillColor', 'strokeColor']],
    ]);
  });

  it('sets and clears one field, dropping empty entries', () => {
    const inst = instanceOf(navMain());
    const set = withOverride(inst, 'brand', 'label', 'Hi');
    expect(set.componentOverrides).toEqual({ brand: { label: 'Hi' } });
    const two = withOverride(set, 'brand', 'textColor', '#fff');
    const cleared = withOverride(
      withOverride(two, 'brand', 'label', undefined),
      'brand',
      'textColor',
      undefined,
    );
    expect(cleared).not.toHaveProperty('componentOverrides');
  });
});

describe('an instance in the headless renderer', () => {
  // Imported up front: a dynamic import of the renderer inside the test ran past the test timeout under load.
  it('draws a dashed frame unexpanded and nothing as an expanded anchor', () => {
    const inst = instanceOf(navMain());
    expect(svgBoxed(inst)).toContain('Component');
    expect(svgBoxed({ ...inst, opacity: 0 })).toBe('');
  });
});
