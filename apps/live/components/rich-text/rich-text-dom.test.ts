// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  lineBeforeCaret,
  offsetsToDomRange,
  paragraphEndOffset,
  selectRange,
} from './rich-text-dom';

// The list helpers of the note editor (docs/specs/026-plan/plan-board.md "Working on a board").
function editor(text: string): HTMLElement {
  const root = document.createElement('div');
  root.contentEditable = 'true';
  for (const part of text.split(/(?<=\n)/)) root.appendChild(document.createTextNode(part));
  document.body.replaceChildren(root);
  return root;
}

describe('rich-text-dom caret helpers', () => {
  it("reads the caret's line up to the caret", () => {
    const root = editor('• one\n• tw');
    selectRange(offsetsToDomRange(root, 10, 10));
    expect(lineBeforeCaret(root)).toBe('• tw');
    expect(lineBeforeCaret(null)).toBe('');
  });

  it("finds the end of the caret's paragraph, not of the drawn line", () => {
    const root = editor('first paragraph\nsecond');
    selectRange(offsetsToDomRange(root, 3, 3));
    expect(paragraphEndOffset(root)).toBe(15);
    selectRange(offsetsToDomRange(root, 18, 18));
    expect(paragraphEndOffset(root)).toBe(22);
  });
});
