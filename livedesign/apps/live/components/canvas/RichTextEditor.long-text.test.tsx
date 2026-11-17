// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createText } from '@livedesign/design';
import { RichTextEditor } from './RichTextEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// canvas-performance.md "Typing in a long label stays light" (Work Tracker 1081): a keystroke in a 100,000-character
// text does work for the change, and the editor lays the text out line by line only when its lines could read in
// different directions (canvas-and-palette.md "Labels").

afterEach(cleanup);

const LONG = 'lorem ipsum dolor sit amet '.repeat(4000).slice(0, 100_000);

function edit(initialLabel: string) {
  const { container } = render(
    <RichTextEditor
      element={createText(0, 0)}
      initialLabel={initialLabel}
      placeholder="Text"
      textSize="md"
      alignX="left"
      alignY="top"
      padding="normal"
      multiline
      cursorAtEnd
      onCommit={() => {}}
      onCancel={() => {}}
    />,
  );
  return container.querySelector<HTMLElement>('[contenteditable]')!;
}

// Type one character at the end, as the browser does: into the last text node, then the input event.
function typeAtEnd(editor: HTMLElement, char: string) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) last = n as Text;
  last!.appendData(char);
  const range = document.createRange();
  range.setStart(last!, last!.length);
  range.collapse(true);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  fireEvent.input(editor);
}

describe('RichTextEditor in a long text', () => {
  it('lays long left-to-right text out as one run, not line by line', () => {
    const editor = edit(`${LONG}\n${LONG}`);
    expect(editor.style.unicodeBidi).toBe('isolate');
  });

  it('lays right-to-left text out line by line once it has a second line', () => {
    const editor = edit('مرحبا بالعالم!');
    expect(editor.style.unicodeBidi).toBe('isolate');
    act(() => typeAtEnd(editor, '\nHello'));
    expect(editor.style.unicodeBidi).toBe('plaintext');
  });

  it('keeps a keystroke at the end of 100,000 characters inside its budget', () => {
    const editor = edit(LONG);
    act(() => typeAtEnd(editor, 'a'));
    let best = Infinity;
    for (let i = 0; i < 5; i++)
      best = Math.min(
        best,
        cpuMsOf(() => act(() => typeAtEnd(editor, 'b'))),
      );
    expect(editor.textContent).toHaveLength(100_006);
    expect(best).toBeLessThan(cpuBudgetMs(10));
  });
});
