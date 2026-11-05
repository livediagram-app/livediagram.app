// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { elementAt, onPaintedText } from './avatar-press-target';

const el = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    ...over,
  }) as unknown as Element;

describe('elementAt', () => {
  it('finds the topmost box under the point, and null on the bare floor', () => {
    const elements = [el('under', { width: 300, height: 300 }), el('over')];
    expect(elementAt(elements, { x: 50, y: 20 })?.id).toBe('over');
    expect(elementAt(elements, { x: 200, y: 200 })?.id).toBe('under');
    expect(elementAt(elements, { x: 400, y: 400 })).toBeNull();
  });

  it('turns the point into a rotated box', () => {
    const turned = [el('t', { rotation: 90 })];
    // Turned a quarter, the 100 x 40 box stands 40 wide and 100 tall about its centre (50, 20).
    expect(elementAt(turned, { x: 50, y: -20 })?.id).toBe('t');
    expect(elementAt(turned, { x: 5, y: 20 })).toBeNull();
  });

  it('never hits an arrow', () => {
    expect(elementAt([el('a', { type: 'arrow' })], { x: 50, y: 20 })).toBeNull();
  });
});

describe('elementAt with a painted check', () => {
  it('passes a box with nothing drawn at the point down to what is under it', () => {
    const elements = [el('floor', { width: 300, height: 300 }), el('words', { type: 'text' })];
    expect(elementAt(elements, { x: 50, y: 20 }, (e) => e.id !== 'words')?.id).toBe('floor');
  });
});

// jsdom lays nothing out, so Range has no getClientRects: give it one for the test, and take it away after.
function stubRects(rects: DOMRect[]): () => void {
  const proto = Range.prototype as unknown as { getClientRects?: () => DOMRect[] };
  proto.getClientRects = () => rects;
  return () => {
    delete proto.getClientRects;
  };
}

describe('onPaintedText', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;

  it('is on the words and their small margin, and off the empty run past them', () => {
    const node = document.createElement('div');
    node.setAttribute('data-element-id', 't1');
    node.innerHTML = '<p style="width:1500px">Build it together</p>';
    document.body.appendChild(node);
    const spy = stubRects([rect(100, 100, 200, 20)]);
    expect(onPaintedText('t1', 150, 110)).toBe(true);
    expect(onPaintedText('t1', 304, 110)).toBe(true);
    expect(onPaintedText('t1', 900, 110)).toBe(false);
    spy();
    node.remove();
  });

  it('lets the box stand when there is no node or no layout to read', () => {
    expect(onPaintedText('missing', 0, 0)).toBe(true);
    const node = document.createElement('div');
    node.setAttribute('data-element-id', 't2');
    node.textContent = 'Words';
    document.body.appendChild(node);
    const spy = stubRects([]);
    expect(onPaintedText('t2', 0, 0)).toBe(true);
    spy();
    node.remove();
  });
});
