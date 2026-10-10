import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { applied, lines } from './fixtures/outcomes';
import { boxIn, flowWith, lockedFlow, run } from './fixtures/run';

describe('make room', () => {
  it("shifts within b's container, and grows it so nothing leaves", () => {
    const outcome = run('insert square between n4 n5');
    expect(lines(outcome)).toEqual([
      '+ square  square @50,400 120×120',
      '~ f2  taller 200→360',
      '~ a4  to n5→square',
      '+ arrow  square→n5 (style of a4)',
      '» n5 n6 n7 n8  +0,+160 (make room)',
      'f2  +square',
    ]);
  });

  it("without a container, shifts b's connected group and the containers in it, whole", () => {
    expect(lines(run('insert diamond between n2 n3'))).toEqual([
      '+ diamond  diamond @50,200 120×120',
      '~ a2  to n3→diamond',
      '+ arrow  diamond→n3 (style of a2)',
      '» f2 n3 n4 n5 n6 n7 n8  +0,+160 (make room)',
    ]);
  });

  it('leaves what is not connected to b where it is', () => {
    const tab = applied(run('insert square between n6 n7')).tab;
    expect(boxIn(tab, 't1')).toEqual(boxIn(checkoutFlow(), 't1'));
  });

  it('passes a locked unit by, and the rest still shift (E17)', () => {
    const tab = applied(run('insert square between n5 n6', lockedFlow('n7'))).tab;
    expect(boxIn(tab, 'n7')).toEqual(boxIn(checkoutFlow(), 'n7'));
    expect(boxIn(tab, 'n8')[1]).toBe(720 + 160);
  });

  it('leaves a locked container and everything in it where they are (EO47)', () => {
    const tab = applied(run('insert diamond between n2 n3', lockedFlow('f2'))).tab;
    for (const id of ['f2', 'n4', 'n5']) expect(boxIn(tab, id)).toEqual(boxIn(checkoutFlow(), id));
    expect(boxIn(tab, 'n3')[1]).toBe(boxIn(checkoutFlow(), 'n3')[1]! + 160);
  });

  it('leaves a locked container ungrown (EO47)', () => {
    const tab = applied(run('insert square between n4 n5', lockedFlow('f2'))).tab;
    expect(boxIn(tab, 'f2')).toEqual(boxIn(checkoutFlow(), 'f2'));
  });

  it('grows nested containers outward and shifts what lies past the outer one', () => {
    const outer: Element = {
      id: 'big',
      type: 'shape',
      shape: 'frame',
      x: -80,
      y: 240,
      width: 300,
      height: 300,
    };
    const flow = checkoutFlow();
    const tab: Tab = { ...flow, elements: [outer, ...flow.elements] };
    const out = applied(run('insert square between n4 n5', tab)).tab;
    expect(boxIn(out, 'f2')[3]).toBe(360);
    expect(boxIn(out, 'big')[3]).toBe(460);
    // n6's centre (540) lay inside big, past f2: it shifts as big's member.
    expect(boxIn(out, 'n6')[1]).toBe(660);
    expect(boxIn(out, 'n8')[1]).toBe(880);
  });

  it('grows a container leftwards when the flow runs left', () => {
    const row = flowWith((el) => {
      if (el.id === 'f2') return { ...el, x: 200, y: 580, width: 400, height: 140 } as Element;
      if (el.id === 'n8') return { ...el, x: 420, y: 620 } as Element;
      if (el.id === 'n7') return { ...el, x: 240, y: 620 } as Element;
      return el;
    });
    const out = applied(
      run('insert square between n8 n7\n', {
        ...row,
        elements: [
          ...row.elements,
          {
            id: 'back',
            type: 'arrow',
            from: { kind: 'pinned', elementId: 'n8', anchor: 'w' },
            to: { kind: 'pinned', elementId: 'n7', anchor: 'e' },
          } as Element,
        ],
      }),
    ).tab;
    const [x, , width] = boxIn(out, 'f2');
    expect(width).toBeGreaterThan(400);
    expect(x).toBeLessThan(200);
  });

  it('carries a free-ended arrow inside a shifted container', () => {
    const loose: Element = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 300, y: 650 },
      to: { kind: 'free', x: 320, y: 700 },
    };
    const outer: Element = {
      id: 'pay',
      type: 'shape',
      shape: 'frame',
      x: -40,
      y: 600,
      width: 400,
      height: 200,
    };
    const flow = checkoutFlow();
    const tab: Tab = { ...flow, elements: [outer, ...flow.elements, loose] };
    const out = applied(run('insert square between n5 n6', tab)).tab;
    expect(out.elements.find((e) => e.id === 'loose')).toMatchObject({
      from: { x: 300, y: 810 },
      to: { x: 320, y: 860 },
    });
  });

  it('logs what it shifted and grew', () => {
    const logged: [string, unknown][] = [];
    run('insert square between n4 n5', checkoutFlow(), {
      log: (message, fields) => logged.push([message, fields]),
    });
    expect(logged).toContainEqual([
      '[edit-ops] make-room',
      { operation: 1, shifted: 4, axis: 'y', grown: 1 },
    ]);
  });

  it('grows a mind map parent no room, but still makes room past it', () => {
    const flow = checkoutFlow();
    const mind = flow.elements.map((el) =>
      el.id === 'n5'
        ? ({ ...el, shape: 'mind-node', mindParentId: 'n4' } as Element)
        : el.id === 'n4'
          ? ({ ...el, shape: 'mind-node' } as Element)
          : el,
    );
    const out = applied(
      run('connect n5 -> n6 again\nrm a5\ninsert square between n5 n6', {
        ...flow,
        elements: mind,
      }),
    ).tab;
    expect(boxIn(out, 'n6')[1]).toBeGreaterThan(500);
  });

  it('grows a container rightwards when the flow runs right', () => {
    const row = flowWith((el) => {
      if (el.id === 'f2') return { ...el, x: 200, y: 580, width: 400, height: 140 } as Element;
      if (el.id === 'n7') return { ...el, x: 240, y: 620 } as Element;
      if (el.id === 'n8') return { ...el, x: 420, y: 620 } as Element;
      return el;
    });
    const out = applied(run('insert square between n7 n8', row)).tab;
    const [x, , width] = boxIn(out, 'f2');
    expect(x).toBe(200);
    expect(width).toBeGreaterThan(400);
  });

  it('grows a container upwards when the flow runs up', () => {
    const up = flowWith((el) =>
      el.id === 'a4'
        ? ({
            ...el,
            from: { ...(el as { from: object }).from, elementId: 'n5' },
            to: { kind: 'pinned', elementId: 'n4', anchor: 's' },
          } as Element)
        : el,
    );
    const out = applied(run('insert square between n5 n4', up)).tab;
    const [, y, , height] = boxIn(out, 'f2');
    expect(height).toBeGreaterThan(200);
    expect(y).toBeLessThan(280);
  });
});
