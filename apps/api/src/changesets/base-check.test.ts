import { describe, expect, it } from 'vitest';
import { elementFingerprint, type Element, type Tab } from '@livediagram/document';
import { checkBase } from './base-check';

// docs/specs/024-agents/agent-changesets.md "Conflicts", one case per row of the blueprint's table.

const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as Element;
const stored = (rev: number, elements: Element[]): Tab & { rev: number } => ({
  id: 't1',
  name: 'T',
  elements,
  rev,
});
const fp = elementFingerprint;

describe('checkBase', () => {
  const now = stored(5, [box('a'), box('b'), box('c')]);

  it('refuses strict without a base', () => {
    expect(checkBase(undefined, now, ['a'], [], true)).toEqual({
      ok: false,
      status: 400,
      error: 'strict_needs_base',
    });
  });

  it('applies without a base, warning no_base', () => {
    expect(checkBase(undefined, now, ['a'], [], false)).toEqual({
      ok: true,
      rebasedOver: 0,
      warnings: ['no_base'],
    });
  });

  it('refuses a base newer than the tab, or than a tab not yet made', () => {
    expect(checkBase({ rev: 6 }, now, [], [], false)).toMatchObject({
      status: 400,
      error: 'invalid_base',
    });
    expect(checkBase({ rev: 1 }, null, [], [], false)).toMatchObject({
      status: 400,
      error: 'invalid_base',
    });
    expect(checkBase({ rev: 0 }, null, [], ['n'], false)).toEqual({
      ok: true,
      rebasedOver: 0,
      warnings: [],
    });
  });

  it('applies on an unchanged revision, strict included', () => {
    expect(checkBase({ rev: 5 }, now, ['a'], [], true)).toEqual({
      ok: true,
      rebasedOver: 0,
      warnings: [],
    });
  });

  it('answers stale_tab for strict on a changed revision', () => {
    expect(checkBase({ rev: 3, elements: { a: fp(box('a')) } }, now, ['a'], [], true)).toEqual({
      ok: false,
      status: 412,
      error: 'stale_tab',
      rev: 5,
    });
  });

  it('rebases over other writes when every target is as read', () => {
    const base = { rev: 3, elements: { a: fp(box('a')), b: fp(box('b')) } };
    expect(checkBase(base, now, ['a', 'b', 'n'], ['n'], false)).toEqual({
      ok: true,
      rebasedOver: 2,
      warnings: [],
    });
  });

  it('collects every conflict: changed, vanished, and a target the base never read', () => {
    const base = { rev: 3, elements: { a: fp(box('a', 'old')), gone: fp(box('gone')) } };
    const out = checkBase(base, now, ['a', 'c', 'gone'], [], false);
    expect(out).toEqual({
      ok: false,
      status: 409,
      error: 'changeset_conflict',
      rev: 5,
      conflicts: [
        { id: 'a', reason: 'changed', readFingerprint: fp(box('a', 'old')), now: box('a') },
        { id: 'gone', reason: 'vanished', readFingerprint: fp(box('gone')), now: null },
        { id: 'c', reason: 'resolves_differently', readFingerprint: null, now: box('c') },
      ],
    });
  });

  it('a base carrying only a revision resolves every target differently once the tab moved', () => {
    const out = checkBase({ rev: 4 }, now, ['b'], [], false);
    expect(out).toMatchObject({
      status: 409,
      conflicts: [{ id: 'b', reason: 'resolves_differently' }],
    });
  });

  it('ignores live fields: a comment added since is no conflict', () => {
    const commented = {
      ...box('a'),
      commentThread: {
        resolved: false,
        comments: [{ id: 'c', text: 'hi', createdAt: 1, authorName: 'B', authorColor: '#f00' }],
      },
    } as Element;
    const out = checkBase(
      { rev: 3, elements: { a: fp(box('a')) } },
      stored(5, [commented]),
      ['a'],
      [],
      false,
    );
    expect(out).toEqual({ ok: true, rebasedOver: 2, warnings: [] });
  });
});
