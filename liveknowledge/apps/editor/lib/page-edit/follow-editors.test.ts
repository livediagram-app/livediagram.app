import { describe, expect, it } from 'vitest';
import { newEditorOf } from './follow-editors';

const priya = { id: 'p', name: 'Priya' };
const sam = { id: 's', name: 'Sam' };

describe('joining the people editing', () => {
  it('follows someone who starts editing, or is editing when the page opens', () => {
    expect(newEditorOf([], [priya])).toBe(priya);
  });

  it('never pulls again for the people already editing (after Cancel)', () => {
    expect(newEditorOf(['p'], [priya])).toBeNull();
    expect(newEditorOf(['p'], [])).toBeNull();
  });

  it('follows a second person who starts', () => {
    expect(newEditorOf(['p'], [priya, sam])).toBe(sam);
  });
});
