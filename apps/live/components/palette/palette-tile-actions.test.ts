import { describe, expect, it, vi } from 'vitest';
import { withTileActionPreamble } from './palette-tile-actions';

describe('withTileActionPreamble', () => {
  it('runs the preamble before each action, with the arguments intact', () => {
    const order: string[] = [];
    const addShape = vi.fn((kind: string) => order.push(`add:${kind}`));
    const wrapped = withTileActionPreamble({ addShape }, () => order.push('exit'));

    wrapped.addShape('square');

    expect(order).toEqual(['exit', 'add:square']);
    expect(addShape).toHaveBeenCalledWith('square');
  });

  it('passes non-function entries through untouched', () => {
    const wrapped = withTileActionPreamble({ hasImage: false, addText: () => {} }, () => {});
    expect(wrapped.hasImage).toBe(false);
  });

  it('returns the wrapped action’s value, so a handler that reports back still can', () => {
    const wrapped = withTileActionPreamble({ addIcon: () => 'dropped' }, () => {});
    expect(wrapped.addIcon()).toBe('dropped');
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
