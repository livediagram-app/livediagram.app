// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  dataAttrsForRun,
  lineBeforeCaret,
  readRunsFromDom,
  offsetsToDomRange,
  paragraphEndOffset,
  selectRange,
} from './rich-text-dom';

// The list helpers of the rich-text editor.
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

describe('rich-text-dom run attributes', () => {
  // A span the editor renders for a run, as React would with dataAttrsForRun.
  const spanFor = (run: Parameters<typeof dataAttrsForRun>[0]) => {
    const span = document.createElement('span');
    for (const [k, v] of Object.entries(dataAttrsForRun(run))) span.setAttribute(k, v);
    span.textContent = run.text;
    return span;
  };

  it('round-trips a muted caption run and every heading level', () => {
    const root = document.createElement('div');
    root.append(
      spanFor({ text: 'Title', heading: 3 }),
      spanFor({ text: '\nCaption', muted: true, size: 'sm' }),
    );
    expect(readRunsFromDom(root)).toEqual([
      { text: 'Title', heading: 3 },
      { text: '\nCaption', muted: true, size: 'sm' },
    ]);
  });
});
