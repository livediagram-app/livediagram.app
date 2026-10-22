import { describe, expect, it } from 'vitest';
import { isStartCardKey, nextCardIndex } from './start-card-keys';

// docs/specs/007-editor/start-panel.md "Keyboard": a grid of three columns, two rows and a lone card below.
const box = (col: number, row: number) => ({
  left: col * 100,
  top: row * 50,
  width: 90,
  height: 40,
});
const grid = [box(0, 0), box(1, 0), box(2, 0), box(0, 1), box(1, 1), box(2, 1), box(0, 2)];

describe('nextCardIndex', () => {
  it('moves Left and Right in reading order, stopping at the ends', () => {
    expect(nextCardIndex('ArrowRight', 2, grid)).toBe(3);
    expect(nextCardIndex('ArrowLeft', 3, grid)).toBe(2);
    expect(nextCardIndex('ArrowLeft', 0, grid)).toBeNull();
    expect(nextCardIndex('ArrowRight', 6, grid)).toBeNull();
  });

  it('moves Up and Down to the nearest card in the next row', () => {
    expect(nextCardIndex('ArrowDown', 1, grid)).toBe(4);
    expect(nextCardIndex('ArrowUp', 5, grid)).toBe(2);
    expect(nextCardIndex('ArrowDown', 5, grid)).toBe(6);
    expect(nextCardIndex('ArrowUp', 0, grid)).toBeNull();
    expect(nextCardIndex('ArrowDown', 6, grid)).toBeNull();
  });

  it('goes to the first and last with Home and End', () => {
    expect(nextCardIndex('Home', 4, grid)).toBe(0);
    expect(nextCardIndex('End', 0, grid)).toBe(6);
  });

  it('knows its keys', () => {
    expect(isStartCardKey('ArrowUp')).toBe(true);
    expect(isStartCardKey('Enter')).toBe(false);
  });
});
