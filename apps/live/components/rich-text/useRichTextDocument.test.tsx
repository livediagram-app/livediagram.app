// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRichTextDocument } from './useRichTextDocument';
import type { TextRun } from '@livediagram/document';

// The editor's live text is state, updated whenever the runs change, so render reads it rather than the
// contentEditable (docs/specs/003-system-architecture/react-state-and-effects.md). It drives the list
// toolbar and the auto-fit.
const setup = (runs: TextRun[]) =>
  renderHook(() =>
    useRichTextDocument({
      initialRuns: runs,
      runStyle: () => ({}),
      defaults: {
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        color: '#000000',
      },
      collapsedScope: 'all',
      trackFormat: () => {},
    }),
  );

describe('useRichTextDocument live text', () => {
  it('starts as the opening text', () => {
    const { result } = setup([{ text: 'Hello' }]);
    expect(result.current.liveText).toBe('Hello');
  });

  it('follows an edit read back from the editor', () => {
    const { result } = setup([{ text: 'Hello' }]);
    const editor = document.body.appendChild(document.createElement('div'));
    result.current.editorRef.current = editor;
    act(() => {
      editor.textContent = '- one';
      result.current.syncFromDom();
    });
    expect(result.current.liveText).toBe('- one');
  });
});

// An Enter at the very end opens an empty last line; the caret must land on it. WebKit settles a
// caret set before that line exists back before the newline, so the read-back sets it again.
describe('useRichTextDocument, an Enter at the end', () => {
  it('sets the caret again once the empty last line is there', () => {
    const { result } = setup([{ text: 'Hi' }]);
    const editor = document.body.appendChild(document.createElement('div'));
    result.current.editorRef.current = editor;
    const nl = document.createTextNode('\n');
    editor.append('Hi', nl);
    const range = document.createRange();
    range.setStart(nl, 1);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    const added: Range[] = [];
    const addRange = Selection.prototype.addRange;
    Selection.prototype.addRange = function (r: Range) {
      added.push(r);
      addRange.call(this, r);
    };
    act(() => result.current.syncFromDom());
    Selection.prototype.addRange = addRange;
    expect(editor.lastChild?.nodeName).toBe('BR');
    expect(added).toHaveLength(1);
    expect(added[0]!.startContainer).toBe(nl);
    expect(added[0]!.startOffset).toBe(1);
  });
});
