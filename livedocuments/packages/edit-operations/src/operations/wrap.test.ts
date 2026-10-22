import { describe, expect, it } from 'vitest';
import { FRAME_PAD, FRAME_TOP, type Element } from '@livedocuments/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, elementOf, flowWith, lockedFlow, run } from '../fixtures/run';
import { PLACEMENT_GAP } from '../vocabulary';
import { clearOf, wrapBox } from './wrap';

const order = (text: string) => applied(run(text)).tab.elements.map((el) => el.id);

describe('wrap', () => {
  it('draws a frame around the members, before the earliest of them', () => {
    const outcome = run('wrap n7 n8 in frame label=Payment');
    expect(lines(outcome)).toEqual([
      '+ payment  frame "Payment" @8,556 204×256',
      'payment  +n7 +n8',
    ]);
    expect(boxIn(applied(outcome).tab, 'payment')).toEqual([
      -FRAME_PAD,
      620 - FRAME_TOP,
      140 + 2 * FRAME_PAD,
      160 + FRAME_TOP + FRAME_PAD,
    ]);
    expect(order('wrap n7 n8 in frame').indexOf('frame-2')).toBe(
      order('wrap n7 n8 in frame').indexOf('n7') - 1,
    );
  });

  it('takes members from refs, quoted labels, and the other words together', () => {
    expect(lines(run('wrap "Charge card" n8 in frame'))[1]).toBe('frame-2  +n7 +n8');
    expect(lines(run('wrap label~card in:f2 in frame')).slice(1)).toEqual([
      'f2  +frame-2 -n5',
      'frame-2  +n5',
    ]);
  });

  it('lays the members out first with tidy', () => {
    expect(lines(run('wrap n7 n8 in frame tidy'))).toEqual([
      '~ a7  arrowStyle →straight',
      '+ frame-2  frame "Frame" @8,556 204×306',
      '» n8  laid out (flow, down)',
      'frame-2  +n7 +n8',
    ]);
    expect(refused(run('wrap n7 n8 in frame tidy', lockedFlow('n8'))).code).toBe('element_locked');
  });

  it('refuses to capture a non-member, naming it and the box', () => {
    expect(refused(run('wrap n6 n8 in frame'))).toMatchObject({
      code: 'frame_captures',
      details: ['the frame @8,436 204×376 would hold non-members:', '  n7  square "Charge card"'],
      hint: 'add them to the members, or add absorb or make-room',
    });
  });

  it('absorbs the captured into the members', () => {
    expect(lines(run('wrap n6 n8 in frame absorb'))).toEqual([
      '+ frame-2  frame "Frame" @8,436 204×376',
      'frame-2  +n6 +n7 +n8',
    ]);
  });

  it('moves the captured out past the nearest edge with make-room', () => {
    const outcome = run('wrap n6 n8 in frame make-room');
    expect(lines(outcome)).toEqual([
      '+ frame-2  frame "Frame" @8,436 204×376',
      '» n7  -262,+0 (make room)',
      'frame-2  +n6 +n8',
    ]);
    expect(boxIn(applied(outcome).tab, 'n7')[0] + 140).toBe(-FRAME_PAD - PLACEMENT_GAP);
    expect(refused(run('wrap n6 n8 in frame make-room', lockedFlow('n7'))).code).toBe(
      'element_locked',
    );
  });

  it('carries what a captured container holds out with it, and leaves locked contents', () => {
    const tab = {
      ...checkoutFlow(),
      elements: [
        ...checkoutFlow().elements,
        {
          id: 'pin',
          type: 'arrow',
          from: { kind: 'free', x: 10, y: 300 },
          to: { kind: 'free', x: 20, y: 310 },
        } as Element,
      ],
    };
    const out = applied(run('wrap n3 n6 in frame make-room', tab)).tab;
    const [fx] = boxIn(out, 'f2');
    expect(fx).not.toBe(-40);
    expect(boxIn(out, 'n4')[0] - fx).toBe(40);
    expect(elementOf(out, 'pin')).not.toMatchObject({ from: { x: 10 } });
  });

  it('holds boxes, not only arrows', () => {
    expect(refused(run('wrap a1 in frame')).details).toEqual([
      'a1: only arrows; a frame holds boxes',
    ]);
  });

  it('nests inside a container that holds the whole box', () => {
    expect(lines(run('wrap n4 in frame'))).toEqual([
      '+ frame-2  frame "Frame" @8,236 204×156',
      'f2  +frame-2 -n4',
      'frame-2  +n4',
    ]);
  });

  it('refuses a missing member and a bad field', () => {
    expect(refused(run('wrap nowhere in frame')).code).toBe('target_not_found');
    expect(refused(run('wrap n7 in frame bogus=1')).code).toBe('unknown_field');
    expect(refused(run('wrap n7 in frame id=n2')).code).toBe('id_taken');
  });

  it("goes on the earliest member's layer", () => {
    const tab = {
      ...flowWith((el) => (el.id === 'n7' ? { ...el, layerId: 'top' } : el)),
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'top', name: 'Top' },
      ],
    };
    expect(elementOf(applied(run('wrap n7 in frame', tab)).tab, 'frame-2')).toMatchObject({
      layerId: 'top',
    });
  });

  it('moves a captured container out with what it holds, members and locked elements staying', () => {
    const outcome = run('wrap n4 n6 in frame make-room');
    const { tab } = applied(outcome);
    expect(boxIn(tab, 'n4')).toEqual(boxIn(checkoutFlow(), 'n4'));
    expect(boxIn(tab, 'n5')[0]).not.toBe(0);
    const locked = applied(run('wrap n4 n6 in frame make-room', lockedFlow('n5'))).tab;
    expect(boxIn(locked, 'n5')).toEqual(boxIn(checkoutFlow(), 'n5'));
  });

  it('refuses members whose words match nothing, or do not read', () => {
    expect(refused(run('wrap n3 type:nothing in frame')).code).toBe('target_not_found');
    const outcome = applyEditOperations(checkoutFlow(), [
      { op: 'wrap', targets: ['"open'], in: 'frame' },
    ]);
    expect(refused(outcome).code).toBe('parse_error');
  });

  it('answers a line that does not parse with its error', () => {
    expect(refused(run('wrap n3 in box')).code).toBe('parse_error');
  });
});

describe('wrapBox', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };

  it('pads a frame on every side, deeper at the top for its title', () => {
    expect(wrapBox([box])).toEqual({
      x: -FRAME_PAD,
      y: -FRAME_TOP,
      width: 100 + 2 * FRAME_PAD,
      height: 50 + FRAME_TOP + FRAME_PAD,
    });
  });
});

describe('clearOf', () => {
  const frame = { x: 0, y: 0, width: 400, height: 400 };
  it('pushes out through the nearest edge', () => {
    expect(clearOf({ x: 10, y: 150, width: 20, height: 20 }, frame)).toEqual([
      -30 - PLACEMENT_GAP,
      0,
    ]);
    expect(clearOf({ x: 370, y: 150, width: 20, height: 20 }, frame)).toEqual([
      30 + PLACEMENT_GAP,
      0,
    ]);
    expect(clearOf({ x: 150, y: 10, width: 20, height: 20 }, frame)).toEqual([
      0,
      -30 - PLACEMENT_GAP,
    ]);
    expect(clearOf({ x: 150, y: 370, width: 20, height: 20 }, frame)).toEqual([
      0,
      30 + PLACEMENT_GAP,
    ]);
  });
});
