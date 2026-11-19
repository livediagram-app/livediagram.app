// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createText } from '@liveworkspace/element-model/testing/elements';
import { createLabelEditor } from './LabelEditor';
import { LINE_ATTR } from './rich-text-lines';

// canvas-performance.md "Typing in a long label stays light" (Work Tracker 1081 and 1188): a keystroke in a
// 100,000-character text does work for the change. The editor is one isolated run; a text whose lines could read in
// different directions is painted a line at a time, each line isolated in its own direction (canvas-and-palette.md
// "Labels"), never laid out with `plaintext`, which costs the square of a line's length.

afterEach(cleanup);

// A binding with no toolbar or telemetry of its own.
const RichTextEditor = createLabelEditor({ Toolbar: () => null, trackFormat: () => {} });

const LONG = 'lorem ipsum dolor sit amet '.repeat(4000).slice(0, 100_000);
const ARABIC = 'مرحبا بالعالم!';
const HEBREW = 'שלום עולם.';

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

function caretIn(node: Text, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
}

function textNodes(editor: HTMLElement): Text[] {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

// Type at `at` in a text node, as the browser does: into that node, then the input event.
function typeInto(editor: HTMLElement, node: Text, at: number, chars: string) {
  node.insertData(at, chars);
  caretIn(node, at + chars.length);
  fireEvent.input(editor);
}

// Type one character at the end of the last text node.
function typeAtEnd(editor: HTMLElement, chars: string) {
  const last = textNodes(editor).at(-1)!;
  typeInto(editor, last, last.length, chars);
}

const lines = (editor: HTMLElement) => editor.querySelectorAll<HTMLElement>(`[${LINE_ATTR}]`);

describe('LabelEditor in a long text', () => {
  it('lays long left-to-right text out as one run, not line by line', () => {
    const editor = edit(`${LONG}\n${LONG}`);
    expect(editor.style.unicodeBidi).toBe('isolate');
    expect(lines(editor)).toHaveLength(0);
  });

  it('paints right-to-left text a line at a time once it has a second line, never with plaintext', () => {
    const editor = edit(ARABIC);
    expect(lines(editor)).toHaveLength(0);
    act(() => typeAtEnd(editor, '\nHello'));
    expect(editor.style.unicodeBidi).toBe('isolate');
    const painted = [...lines(editor)];
    expect(painted.map((line) => line.textContent)).toEqual([ARABIC, 'Hello']);
    expect(
      painted.every((line) => line.dir === 'auto' && line.style.unicodeBidi === 'isolate'),
    ).toBe(true);
    expect(editor.textContent).toBe(`${ARABIC}\nHello`);
  });

  it('keeps the caret where it was when it paints the lines again', () => {
    const editor = edit(`${ARABIC}\nHello`);
    const hello = textNodes(editor).at(-1)!;
    // A newline typed inside a line runs two lines together: painted again, the caret stays after it.
    act(() => typeInto(editor, hello, 2, '\n'));
    expect([...lines(editor)].map((line) => line.textContent)).toEqual([ARABIC, 'He', 'llo']);
    const sel = window.getSelection()!.getRangeAt(0);
    const before = document.createRange();
    before.setStart(editor, 0);
    before.setEnd(sel.startContainer, sel.startOffset);
    expect(before.toString()).toBe(`${ARABIC}\nHe\n`);
  });

  it('goes back to one run when the last newline goes', () => {
    const editor = edit(`${ARABIC}\nHello`);
    expect(lines(editor)).toHaveLength(2);
    act(() => {
      editor.textContent = `${ARABIC} Hello`;
      caretIn(editor.firstChild as Text, 3);
      fireEvent.input(editor);
    });
    expect(lines(editor)).toHaveLength(0);
    expect(editor.textContent).toBe(`${ARABIC} Hello`);
  });

  it("reads in the direction of the caret's line, and from its first letter once flat again", () => {
    const editor = edit(`${ARABIC}\nHello`);
    expect(editor.dir).toBe('auto');
    const arabic = lines(editor)[0]!;
    // jsdom resolves no `dir="auto"`: the line's computed direction stands in for the browser's.
    arabic.style.direction = 'rtl';
    act(() => {
      editor.focus();
      caretIn(textNodes(editor)[0]!, 2);
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(editor.dir).toBe('rtl');
    // Typing in the left-to-right line turns it back.
    act(() => typeInto(editor, textNodes(editor).at(-1)!, 5, '!'));
    expect(editor.dir).toBe('ltr');
    act(() => {
      editor.textContent = `${ARABIC} Hello`;
      caretIn(editor.firstChild as Text, 3);
      fireEvent.input(editor);
    });
    expect(editor.dir).toBe('auto');
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

  it('keeps a keystroke in a 100,000-character line of mixed-direction text inside its budget, painting nothing', () => {
    const editor = edit(`${ARABIC}\n${LONG}\n${HEBREW}`);
    const long = textNodes(editor).find((node) => node.length === LONG.length)!;
    act(() => typeInto(editor, long, 50_000, 'a'));
    let best = Infinity;
    for (let i = 0; i < 5; i++)
      best = Math.min(
        best,
        cpuMsOf(() => act(() => typeInto(editor, long, 50_000, 'b'))),
      );
    // Typed into the same text node every time: nothing was painted again.
    expect(long.isConnected).toBe(true);
    expect(lines(editor)).toHaveLength(3);
    expect(editor.textContent).toHaveLength(ARABIC.length + LONG.length + HEBREW.length + 2 + 6);
    expect(best).toBeLessThan(cpuBudgetMs(10));
  });
});
