import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { judgeRoomElementOp } from '@liveworkspace/api-kit/room-element-ops';
import { ROOM_ELEMENT_RULES } from './room-element-rules';

// The room's element gate over this product's real validator and migrations (docs/specs/012-collaboration/
// realtime-conflict-resolution.md "An invalid element").
const judge = (op: unknown) => judgeRoomElementOp(op, ROOM_ELEMENT_RULES);
const box = { x: 0, y: 0, width: 100, height: 60 };
const shape = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'square',
  label: 'A step',
  ...box,
  ...extra,
});
const arrow = (id: string, from: unknown) => ({
  id,
  type: 'arrow',
  from,
  to: { kind: 'free', x: 10, y: 20 },
});
const add = (element: unknown) => ({ kind: 'el', tabId: 't', op: { kind: 'add', element } });
const tab = (elements: unknown[]) => ({
  kind: 'tab',
  tabId: 't',
  tab: { id: 't', name: 'T', elements },
});

describe('ROOM_ELEMENT_RULES', () => {
  it('relays a valid element and a valid tab', () => {
    const pinned = arrow('r', { kind: 'pinned', elementId: 'a', anchor: 'e' });
    expect(judge(add(shape('a')))).toBeNull();
    expect(judge(tab([shape('a'), shape('b'), pinned]))).toBeNull();
  });

  it('refuses a known kind that fails the validator: an arrow whose from is not an end', () => {
    expect(judge(add(arrow('r', 'a')))).toMatchObject({
      reason: 'invalid-element',
      elementId: 'r',
    });
    expect(judge(tab([shape('a'), arrow('r', { kind: 'nowhere' })]))).toMatchObject({
      reason: 'invalid-element',
      elementId: 'r',
    });
    expect(judge(add(shape('a', { width: 'wide' })))).toEqual({
      reason: 'invalid-element',
      elementId: 'a',
      field: 'width',
    });
  });

  it('relays a kind this build does not know', () => {
    expect(judge(add({ id: 'h', type: 'hologram', from: 'anywhere' }))).toBeNull();
    expect(judge(tab([shape('a'), { id: 'h', type: 'hologram' }]))).toBeNull();
  });

  it('relays what a newer build may add to a known kind during a deploy: a new field, a new shape kind', () => {
    expect(judge(add(shape('a', { glow: { colour: 3 }, componentId: 'c1' })))).toBeNull();
    expect(judge(add(shape('a', { shape: 'instance' })))).toBeNull();
  });

  // docs/specs/007-editor/pages-mode.md "Sizes": a turned page's shapes carry their label's scale.
  it("relays a re-fitted shape's label scale, and refuses one out of range", () => {
    expect(judge(add(shape('a', { textSize: 16, textScale: 0.46 })))).toBeNull();
    expect(judge(add(shape('a', { textScale: 0 })))).toEqual({
      reason: 'invalid-element',
      elementId: 'a',
      field: 'textScale',
    });
  });

  it('refuses a tab that names an id twice', () => {
    expect(judge(tab([shape('a'), shape('a')]))).toEqual({
      reason: 'duplicate-element',
      elementId: 'a',
    });
  });

  // The hot path: one judge per relayed element op. A typical element costs microseconds; the worst case is a frame
  // at the room's 256 KiB cap, which the JSON.parse before it already reads in full.
  it('judges a typical element and a frame-sized tab or table within a small CPU budget', () => {
    const one = add(shape('a'));
    const typical = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) judge(one);
    });
    const cells = Array.from({ length: 200 }, (_, r) =>
      Array.from({ length: 50 }, (_, c) => `r${r}c${c}`),
    );
    const table = add({ id: 'tb', type: 'table', ...box, cells });
    const big = tab(Array.from({ length: 1500 }, (_, i) => shape(`s${i}`)));
    expect(JSON.stringify(big).length).toBeLessThan(256 * 1024);
    expect(judge(table)).toBeNull();
    expect(judge(big)).toBeNull();
    const large = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) judge(table);
    });
    const whole = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) judge(big);
    });
    expect(typical).toBeLessThan(cpuBudgetMs(100));
    expect(large).toBeLessThan(cpuBudgetMs(100));
    expect(whole).toBeLessThan(cpuBudgetMs(500));
  });
});
