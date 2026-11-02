import { describe, expect, it, vi } from 'vitest';
import {
  createRefusalLog,
  createRoomElementGate,
  judgeRoomElementOp,
  REFUSAL_LOG_LIMIT,
  REFUSAL_LOG_WINDOW_MS,
  type RoomElementRules,
} from './room-element-ops';

// A toy product: `box` needs a numeric `w`; `legacy-box` migrates to a `box` with `w` from `width`. Only `box` is
// known, the way a newer build's kind is unknown to an older room.
const rules: RoomElementRules = {
  knowsType: (type) => type === 'box',
  migrateElement: (el) =>
    'width' in el && !('w' in el) ? { ...el, w: el.width, width: undefined } : el,
  migrateTab: (tab) => {
    const t = tab as { elements: Record<string, unknown>[] };
    return { ...t, elements: t.elements.map((el) => rules.migrateElement(el)) };
  },
  issue: (el) =>
    typeof (el as { w?: unknown }).w === 'number' ? null : { field: 'w', rule: 'a number' },
  maxElements: 3,
};

const box = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'box',
  w: 1,
  ...extra,
});
const add = (element: unknown) => ({ kind: 'el', tabId: 't', op: { kind: 'add', element } });
const tab = (elements: unknown[]) => ({
  kind: 'tab',
  tabId: 't',
  tab: { id: 't', name: 'T', elements },
});

describe('judgeRoomElementOp', () => {
  it('passes a valid el add or update, and a valid tab', () => {
    expect(judgeRoomElementOp(add(box('a')), rules)).toBeNull();
    expect(
      judgeRoomElementOp(
        { kind: 'el', tabId: 't', op: { kind: 'update', element: box('a') } },
        rules,
      ),
    ).toBeNull();
    expect(judgeRoomElementOp(tab([box('a'), box('b')]), rules)).toBeNull();
  });

  it('refuses a known kind whose named field breaks its rule, naming the element and the field', () => {
    expect(judgeRoomElementOp(add(box('a', { w: 'wide' })), rules)).toEqual({
      reason: 'invalid-element',
      elementId: 'a',
      field: 'w',
    });
    expect(judgeRoomElementOp(tab([box('a'), box('b', { w: null })]), rules)).toEqual({
      reason: 'invalid-element',
      elementId: 'b',
      field: 'w',
    });
  });

  it('refuses what every kind shares: an object with an id and a type', () => {
    expect(judgeRoomElementOp(add('box'), rules)).toEqual({
      reason: 'invalid-element',
      field: 'element',
    });
    expect(judgeRoomElementOp(add({ type: 'box', w: 1 }), rules)).toEqual({
      reason: 'invalid-element',
      field: 'id',
    });
    expect(judgeRoomElementOp(add({ id: '', type: 'box' }), rules)?.field).toBe('id');
    expect(judgeRoomElementOp(add({ id: 'a', w: 1 }), rules)).toEqual({
      reason: 'invalid-element',
      elementId: 'a',
      field: 'type',
    });
  });

  it('relays an unknown kind unjudged, even one the known rules would refuse', () => {
    expect(judgeRoomElementOp(add({ id: 'a', type: 'hologram', w: 'wide' }), rules)).toBeNull();
    expect(judgeRoomElementOp(tab([box('a'), { id: 'b', type: 'hologram' }]), rules)).toBeNull();
  });

  it('relays a known kind with a field the rules do not name (a newer build during a deploy)', () => {
    expect(judgeRoomElementOp(add(box('a', { glow: { colour: 3 } })), rules)).toBeNull();
  });

  it('judges the migrated element, so a former shape the migrations upgrade passes', () => {
    expect(judgeRoomElementOp(add({ id: 'a', type: 'box', width: 4 }), rules)).toBeNull();
    expect(judgeRoomElementOp(tab([{ id: 'a', type: 'box', width: 4 }]), rules)).toBeNull();
  });

  it('judges the element as sent when a migration hands nothing back', () => {
    const empty: RoomElementRules = {
      ...rules,
      migrateElement: () => undefined,
      migrateTab: () => null,
    };
    expect(judgeRoomElementOp(add(box('a')), empty)).toBeNull();
    expect(judgeRoomElementOp(add(box('a', { w: 'x' })), empty)?.field).toBe('w');
    expect(judgeRoomElementOp(tab([box('a', { w: 'x' })]), empty)?.elementId).toBe('a');
  });

  it('refuses a tab naming one id twice, whatever the kinds', () => {
    expect(judgeRoomElementOp(tab([box('a'), { id: 'a', type: 'hologram' }]), rules)).toEqual({
      reason: 'duplicate-element',
      elementId: 'a',
    });
  });

  it('refuses a tab holding more elements than a tab may', () => {
    expect(judgeRoomElementOp(tab([box('a'), box('b'), box('c'), box('d')]), rules)).toEqual({
      reason: 'too-many-elements',
    });
  });

  it('passes every op that carries no element, and leaves envelopes to the receivers', () => {
    for (const op of [
      null,
      'tab',
      { kind: 'el', tabId: 't', op: { kind: 'remove', id: 'a' } },
      { kind: 'el', tabId: 't', op: { kind: 'reorder', ids: ['a'] } },
      { kind: 'el', tabId: 't', op: null },
      { kind: 'tab', tabId: 't', tab: null },
      { kind: 'tab', tabId: 't', tab: { id: 't' } },
      { kind: 'tab-meta', tabId: 't', patch: { name: 'x' } },
      { kind: 'el-delta', tabId: 't', elementId: 'a', delta: { kind: 'tick' } },
      { kind: 'hologram-op', element: { id: 'a', type: 'box', w: 'x' } },
    ]) {
      expect(judgeRoomElementOp(op, rules)).toBeNull();
    }
  });
});

describe('createRefusalLog', () => {
  it('writes at most the limit per window, then counts what it held back on the next window', () => {
    const warn = vi.fn();
    const log = createRefusalLog('[test] refused', { limit: 2, windowMs: 1000, warn });
    log({ n: 1 }, 0);
    log({ n: 2 }, 10);
    log({ n: 3 }, 20);
    log({ n: 4 }, 999);
    expect(warn.mock.calls).toEqual([
      ['[test] refused', { n: 1 }],
      ['[test] refused', { n: 2 }],
    ]);
    log({ n: 5 }, 1000);
    expect(warn).toHaveBeenLastCalledWith('[test] refused', { n: 5, suppressed: 2 });
    log({ n: 6 }, 1001);
    expect(warn).toHaveBeenLastCalledWith('[test] refused', { n: 6 });
    // A quiet window carries no count forward.
    log({ n: 7 }, 5000);
    expect(warn).toHaveBeenLastCalledWith('[test] refused', { n: 7 });
  });

  it('defaults to the room bound and console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const log = createRefusalLog('[test] refused');
      for (let i = 0; i < REFUSAL_LOG_LIMIT * 5; i++) log({ i }, i);
      expect(spy).toHaveBeenCalledTimes(REFUSAL_LOG_LIMIT);
      log({ i: 'next' }, REFUSAL_LOG_WINDOW_MS);
      expect(spy).toHaveBeenLastCalledWith('[test] refused', {
        i: 'next',
        suppressed: REFUSAL_LOG_LIMIT * 4,
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('createRoomElementGate', () => {
  it('relays a valid op with no log line', () => {
    const warn = vi.fn();
    const gate = createRoomElementGate(rules, { warn, now: () => 0 });
    expect(gate(add(box('a')), 3)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers a refused op with the frame for its sender, echoing the ref, and logs it without the element', () => {
    const warn = vi.fn();
    const gate = createRoomElementGate(rules, { warn, now: () => 0 });
    expect(gate(add(box('a', { w: 'wide' })), 7)).toEqual({
      kind: 'op-refused',
      op: 'el',
      reason: 'invalid-element',
      tabId: 't',
      elementId: 'a',
      field: 'w',
      ref: 7,
    });
    expect(warn).toHaveBeenCalledWith('[room] element op refused', {
      op: 'el',
      reason: 'invalid-element',
      field: 'w',
    });
  });

  it('leaves out what it cannot echo: a bad ref, a missing tab id, a refusal with no element or field', () => {
    const warn = vi.fn();
    const gate = createRoomElementGate(rules, { warn, now: () => 0 });
    const many = { kind: 'tab', tab: { elements: [box('a'), box('b'), box('c'), box('d')] } };
    for (const ref of [undefined, 0, -1, 1.5, '2']) {
      expect(gate(many, ref)).toEqual({
        kind: 'op-refused',
        op: 'tab',
        reason: 'too-many-elements',
      });
    }
    expect(warn).toHaveBeenLastCalledWith('[room] element op refused', {
      op: 'tab',
      reason: 'too-many-elements',
    });
  });

  it('clamps the ids it repeats back', () => {
    const gate = createRoomElementGate(rules, { warn: () => {} });
    const long = 'x'.repeat(500);
    const frame = gate({
      kind: 'el',
      tabId: long,
      op: { kind: 'add', element: box(long, { w: 'x' }) },
    });
    expect(frame?.tabId).toHaveLength(64);
    expect(frame?.elementId).toHaveLength(64);
  });

  it('bounds its log lines however fast the refusals come', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const gate = createRoomElementGate(rules, { now: () => 0 });
      for (let i = 0; i < 1000; i++) gate(add(box(`e${i}`, { w: 'x' })), i + 1);
      expect(spy).toHaveBeenCalledTimes(REFUSAL_LOG_LIMIT);
    } finally {
      spy.mockRestore();
    }
  });
});
