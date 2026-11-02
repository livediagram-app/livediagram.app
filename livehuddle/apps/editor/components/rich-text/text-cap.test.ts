import { describe, expect, it } from 'vitest';
import { capInsertion } from './text-cap';

// docs/specs/009-elements/badge.md "The element": the editor stops taking text at a badge's or step's cap.
describe('capInsertion', () => {
  it('lets everything through with no cap', () => {
    expect(capInsertion('hello', 100, 0, undefined)).toBe('hello');
  });

  it('cuts an insertion to the room left, and takes nothing once full', () => {
    expect(capInsertion('abcd', 1, 0, 3)).toBe('ab');
    expect(capInsertion('a', 3, 0, 3)).toBe('');
  });

  it('counts the selection it replaces as room', () => {
    expect(capInsertion('xy', 3, 2, 3)).toBe('xy');
    expect(capInsertion('xyz', 3, 1, 3)).toBe('x');
  });
});
