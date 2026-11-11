import { describe, expect, it, vi } from 'vitest';
import { withTileActionPreamble } from './palette-tile-actions';

describe('withTileActionPreamble', () => {
  it('runs the preamble before each action, with the arguments intact', () => {
    const order: string[] = [];
    const addShape = vi.fn((kind: string) => order.push(`add:${kind}`));
    const wrapped = withTileActionPreamble({ addShape }, () => order.push('exit'));

    wrapped.addShape('chair');

    expect(order).toEqual(['exit', 'add:chair']);
    expect(addShape).toHaveBeenCalledWith('chair');
  });

  it('passes non-function entries through untouched', () => {
    const wrapped = withTileActionPreamble({ hasImage: false, addText: () => {} }, () => {});
    expect(wrapped.hasImage).toBe(false);
  });

  it('returns the wrapped action’s value, so a handler that reports back still can', () => {
    const wrapped = withTileActionPreamble({ addSticker: () => 'dropped' }, () => {});
    expect(wrapped.addSticker()).toBe('dropped');
  });

  it('fires the preamble once per call, not once per bundle', () => {
    const preamble = vi.fn();
    const wrapped = withTileActionPreamble({ a: () => {}, b: () => {} }, preamble);
    expect(preamble).not.toHaveBeenCalled();
    wrapped.a();
    wrapped.b();
    expect(preamble).toHaveBeenCalledTimes(2);
  });
});

describe('withTileActionPreamble arguments', () => {
  it('hands the preamble the action and its arguments', () => {
    const seen: unknown[] = [];
    const wrapped = withTileActionPreamble({ addShape: (_k: string) => {} }, (a, args) =>
      seen.push([a, ...args]),
    );
    wrapped.addShape('chair');
    expect(seen).toEqual([['addShape', 'chair']]);
  });
});
