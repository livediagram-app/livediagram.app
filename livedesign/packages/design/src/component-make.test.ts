import { describe, expect, it } from 'vitest';
import { detachInstance, makeComponent, makeComponentRefusal } from './component-make';
import { arrow, box, instanceOf, navMain, text } from './components.test.fixtures';
import { MAX_COMPONENT_ELEMENTS, type DesignComponent } from './components';
import type { ArrowElement, Element } from './index';

const opts = { componentId: 'c1', instanceId: 'i1', name: 'Component 1', now: 5 };
let n = 0;
const newId = () => `n${++n}`;

describe('makeComponent', () => {
  it('turns the selection into a main and one instance in its place', () => {
    const els: Element[] = [
      box('bg', 0, 0, 500, 500),
      box('a', 100, 50, 40, 20, { layerId: 'L', locked: false, commentThread: [] }),
      text('t', 150, 60, 'Hi'),
      box('z', 0, 0),
    ];
    const r = makeComponent(els, new Set(['a', 't']), opts);
    if (!r.ok) throw new Error('refused');
    expect(r.component).toMatchObject({
      id: 'c1',
      name: 'Component 1',
      width: 110,
      height: 30,
      updatedAt: 5,
    });
    expect(r.component.elements.map((e) => e.id)).toEqual(['a', 't']);
    expect(r.component.elements[0]).toMatchObject({ x: 0, y: 0 });
    expect(r.component.elements[0]).not.toHaveProperty('layerId');
    expect(r.component.elements[0]).not.toHaveProperty('commentThread');
    expect(r.elements.map((e) => e.id)).toEqual(['bg', 'i1', 'z']);
    expect(r.instance).toMatchObject({
      shape: 'instance',
      componentId: 'c1',
      x: 100,
      y: 50,
      width: 110,
      height: 30,
      layerId: 'L',
    });
  });

  it('frees arrow ends that leave the selection and re-pins ones that enter it', () => {
    const els: Element[] = [
      box('a', 0, 0, 10, 10),
      box('b', 100, 0, 10, 10),
      box('out', 300, 0, 10, 10),
      arrow(
        'in',
        { kind: 'pinned', elementId: 'a', anchor: 'e' },
        { kind: 'pinned', elementId: 'out', anchor: 'w' },
      ),
      arrow(
        'to',
        { kind: 'pinned', elementId: 'out', anchor: 'w' },
        { kind: 'pinned', elementId: 'b', anchor: 'n' },
      ),
      arrow('hung', { kind: 'on-arrow', arrowId: 'in', t: 0.5 }, { kind: 'free', x: 0, y: 0 }),
      { ...box('chip', 0, 0, 4, 4), attachedTo: 'a' },
    ];
    const r = makeComponent(els, new Set(['a', 'b', 'in']), opts);
    if (!r.ok) throw new Error('refused');
    const inner = r.component.elements.find((e) => e.id === 'in') as ArrowElement;
    expect(inner.from).toEqual({ kind: 'pinned', elementId: 'a', anchor: 'e' });
    expect(inner.to.kind).toBe('free');
    const to = r.elements.find((e) => e.id === 'to') as ArrowElement;
    expect(to.to).toEqual({ kind: 'pinned', elementId: 'i1', anchor: 'n' });
    expect((r.elements.find((e) => e.id === 'hung') as ArrowElement).from.kind).toBe('free');
    expect((r.elements.find((e) => e.id === 'chip') as { attachedTo?: string }).attachedTo).toBe(
      'i1',
    );
  });

  it('detaches instances in the selection into the new main', () => {
    const main = navMain();
    const els: Element[] = [instanceOf(main), box('x', 400, 50)];
    const r = makeComponent(els, new Set(['inst', 'x']), { ...opts, lookup: () => main, newId });
    if (!r.ok) throw new Error('refused');
    expect(r.component.elements).toHaveLength(4);
    expect(r.component.elements.some((e) => e.type === 'shape' && e.shape === 'instance')).toBe(
      false,
    );
    expect(r.elements).toHaveLength(1);
  });

  it('refuses what it cannot make', () => {
    const els: Element[] = [
      box('a', 0, 0, 1, 1, { locked: true }),
      { id: 'img', type: 'image', x: 0, y: 0, width: 1, height: 1, imageId: null },
      instanceOf(navMain()),
    ];
    expect(makeComponentRefusal(els, new Set())).toBe('empty');
    expect(makeComponentRefusal(els, new Set(['a']))).toBe('locked');
    expect(makeComponentRefusal(els, new Set(['img']))).toBe('kind');
    expect(makeComponentRefusal(els, new Set(['inst']))).toBe('missing_main');
    const withImage: DesignComponent = { ...navMain(), elements: [els[1]!] };
    expect(makeComponentRefusal(els, new Set(['inst']), () => withImage)).toBe('kind');
    const many = Array.from({ length: MAX_COMPONENT_ELEMENTS + 1 }, (_, i) => box(`b${i}`, i, 0));
    expect(makeComponent(many, new Set(many.map((e) => e.id)), opts)).toEqual({
      ok: false,
      reason: 'too_many',
    });
    const big: DesignComponent = { ...navMain(), elements: many.slice(0, MAX_COMPONENT_ELEMENTS) };
    expect(
      makeComponentRefusal([instanceOf(big), box('q', 0, 0)], new Set(['inst', 'q']), () => big),
    ).toBe('too_many');
  });

  it('frames a selection of free arrows alone', () => {
    const els: Element[] = [
      arrow('ar', { kind: 'free', x: 10, y: 10 }, { kind: 'free', x: 50, y: 30 }),
    ];
    const r = makeComponent(els, new Set(['ar']), opts);
    if (!r.ok) throw new Error('refused');
    expect(r.component).toMatchObject({ width: 40, height: 20 });
    expect((r.component.elements[0] as ArrowElement).from).toEqual({ kind: 'free', x: 0, y: 0 });
  });
});

describe('detachInstance', () => {
  it('replaces the instance with plain elements, overrides baked in, fresh ids', () => {
    const main = navMain();
    const inst = instanceOf(main, {
      layerId: 'L',
      componentOverrides: { brand: { label: 'Shop' } },
    });
    const els: Element[] = [
      box('a', 0, 0),
      inst,
      arrow(
        'ar',
        { kind: 'pinned', elementId: 'inst', anchor: 'w' },
        { kind: 'pinned', elementId: 'a', anchor: 'e' },
      ),
      arrow('hung', { kind: 'on-arrow', arrowId: 'inst', t: 0 }, { kind: 'free', x: 0, y: 0 }),
    ];
    const out = detachInstance(els, 'inst', main, newId);
    expect(out).toHaveLength(6);
    expect(out[0]!.id).toBe('a');
    expect(out.slice(1, 4).every((e) => e.layerId === 'L' && !e.id.includes('/'))).toBe(true);
    expect(out.find((e) => 'label' in e && e.label === 'Shop')).toBeTruthy();
    const ar = out.find((e) => e.id === 'ar') as ArrowElement;
    expect(ar.from).toEqual({ kind: 'free', x: 100, y: 70 });
    expect(ar.to).toEqual({ kind: 'pinned', elementId: 'a', anchor: 'e' });
    expect((out.find((e) => e.id === 'hung') as ArrowElement).from.kind).toBe('free');
  });

  it('leaves the list alone for an id that is not an instance', () => {
    const els: Element[] = [box('a', 0, 0)];
    expect(detachInstance(els, 'nope', navMain(), newId)).toBe(els);
  });
});
