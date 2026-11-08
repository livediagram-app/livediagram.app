import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { checkoutFlow } from './fixtures/checkout-flow';
import { applied, lines } from './fixtures/outcomes';
import { boxIn, flowWith, run } from './fixtures/run';

describe('make room', () => {
  // Each inserted box is sized 140×120 here, so the shifts read in its height plus the gap (160).
  it("shifts b's connected group past the midline, and nothing else", () => {
    const outcome = run('insert square width=140 height=120 between n4 n5');
    expect(lines(outcome)).toEqual([
      '+ square  square @40,400 140×120',
      '~ a4  to n5→square',
      '+ arrow  square→n5 (style of a4)',
      '» n5 n6 n7 n8  +0,+160 (make room)',
    ]);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: f2 is a stored boundary, a
  // retired kind that holds nothing. Making room neither grows it nor carries it.
  it('leaves a stored boundary as it was, whether the insert lands on it or before it', () => {
    for (const between of ['n4 n5', 'n2 n3']) {
      const tab = applied(run(`insert square width=140 height=120 between ${between}`)).tab;
      expect(tab.elements.find((el) => el.id === 'f2')).toEqual(
        checkoutFlow().elements.find((el) => el.id === 'f2'),
      );
    }
    expect(lines(run('insert diamond width=140 height=120 between n2 n3'))).toEqual([
      '+ diamond  diamond @40,200 140×120',
      '~ a2  to n3→diamond',
      '+ arrow  diamond→n3 (style of a2)',
      '» n3 n4 n5 n6 n7 n8  +0,+160 (make room)',
    ]);
  });

  it('leaves what is not connected to b where it is, a free-ended arrow included', () => {
    const loose: Element = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 300, y: 650 },
      to: { kind: 'free', x: 320, y: 700 },
    };
    const flow = checkoutFlow();
    const tab: Tab = { ...flow, elements: [...flow.elements, loose] };
    const out = applied(run('insert square width=140 height=120 between n6 n7', tab)).tab;
    expect(boxIn(out, 't1')).toEqual(boxIn(checkoutFlow(), 't1'));
    expect(out.elements.find((e) => e.id === 'loose')).toEqual(loose);
  });

  it('shifts left when the flow runs left', () => {
    const row = flowWith((el) => {
      if (el.id === 'n8') return { ...el, x: 420, y: 620 } as Element;
      if (el.id === 'n7') return { ...el, x: 240, y: 620 } as Element;
      return el;
    });
    const out = applied(
      run('insert square width=140 height=120 between n8 n7\n', {
        ...row,
        elements: [
          ...row.elements,
          {
            id: 'back',
            type: 'arrow',
            from: { kind: 'pinned', elementId: 'n8', anchor: 'w' },
            to: { kind: 'pinned', elementId: 'n7', anchor: 'e' },
          },
        ],
      }),
    ).tab;
    expect(boxIn(out, 'n8')[0]).toBe(420);
    expect(boxIn(out, 'n7')[0]).toBeLessThan(240);
  });

  it('shifts right when the flow runs right', () => {
    const row = flowWith((el) => {
      if (el.id === 'n7') return { ...el, x: 240, y: 620 } as Element;
      if (el.id === 'n8') return { ...el, x: 420, y: 620 } as Element;
      return el;
    });
    const out = applied(run('insert square width=140 height=120 between n7 n8', row)).tab;
    expect(boxIn(out, 'n7')[0]).toBe(240);
    expect(boxIn(out, 'n8')[0]).toBeGreaterThan(420);
  });

  it('shifts up when the flow runs up', () => {
    const up = flowWith((el) =>
      el.id === 'a4'
        ? ({
            ...el,
            from: { ...(el as { from: object }).from, elementId: 'n5' },
            to: { kind: 'pinned', elementId: 'n4', anchor: 's' },
          } as Element)
        : el,
    );
    const out = applied(run('insert square width=140 height=120 between n5 n4', up)).tab;
    expect(boxIn(out, 'n4')[1]).toBeLessThan(boxIn(checkoutFlow(), 'n4')[1]);
    expect(boxIn(out, 'n5')[1]).toBe(boxIn(checkoutFlow(), 'n5')[1]);
  });

  it('logs what it shifted', () => {
    const logged: [string, unknown][] = [];
    run('insert square width=140 height=120 between n4 n5', checkoutFlow(), {
      log: (message, fields) => logged.push([message, fields]),
    });
    expect(logged).toContainEqual([
      '[edit-ops] make-room',
      { operation: 1, shifted: 4, axis: 'y' },
    ]);
  });

  it('sums the shifts of two inserts, and keeps what an operation wrote or made a written line', () => {
    const outcome = run(
      [
        'set n5 label=Pay',
        'add square id=z label=Z below:n8',
        'connect n8 -> z',
        'insert square id=i1 width=140 height=120 between n4 n5',
        'insert square id=i2 width=140 height=120 between n6 n7',
      ].join('\n'),
    );
    const out = lines(outcome);
    expect(out).toContain('» n6  +0,+160 (make room)');
    expect(out).toContain('» n7 n8  +0,+320 (make room)');
    expect(out.find((l) => l.startsWith('~ n5'))).toMatch(/label "Card details"→"Pay"/);
    expect(out.find((l) => l.startsWith('+ z '))).toBeDefined();
  });
});
