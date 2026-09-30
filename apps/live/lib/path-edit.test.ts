import { describe, expect, it } from 'vitest';
import { createPath, createShape } from '@livediagram/document';
import { isPathEditing } from './path-edit';

const path = createPath(
  [
    { x: 0, y: 0, mode: 'corner' },
    { x: 50, y: 0, mode: 'corner' },
  ],
  false,
);

describe('isPathEditing', () => {
  it('is open only while a path is the element being edited', () => {
    const square = createShape('square', 0, 0);
    expect(isPathEditing([path, square], path.id)).toBe(true);
    expect(isPathEditing([path, square], square.id)).toBe(false);
    expect(isPathEditing([path], null)).toBe(false);
    expect(isPathEditing([], path.id)).toBe(false);
  });
});
