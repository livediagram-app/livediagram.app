// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRichTextDocument } from './useRichTextDocument';
import type { TextRun } from '@livediagram/diagram';

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
