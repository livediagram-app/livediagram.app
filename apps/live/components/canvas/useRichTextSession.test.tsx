// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/diagram';
import type { RichTextEditorProps } from './RichTextEditor.types';
import { useRichTextSession } from './useRichTextSession';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The label editor's session (docs/specs/008-canvas/canvas-and-palette.md): it paints and selects on
// mount, and commits on unmount only when the text changed, through the handler it has now.

const element = createShape('square', 0, 0);

function Harness({ onCommit }: { onCommit: RichTextEditorProps['onCommit'] }) {
  const { editorRef, syncFromDom } = useRichTextSession({
    element,
    initialLabel: 'Hello',
    textSize: 'md',
    multiline: false,
    cursorAtEnd: false,
    onCommit,
    onCancel: vi.fn(),
  } as Parameters<typeof useRichTextSession>[0]);
  return (
    <div
      data-testid="editor"
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={syncFromDom}
    />
  );
}

function type(container: HTMLElement, text: string) {
  const el = container.querySelector<HTMLElement>('[data-testid="editor"]')!;
  act(() => {
    el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(cleanup);

describe('useRichTextSession', () => {
  it('paints the label on mount', () => {
    const { container } = render(<Harness onCommit={vi.fn()} />);
    expect(container.textContent).toBe('Hello');
  });

  it('commits nothing on unmount when nothing changed', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Harness onCommit={onCommit} />);
    unmount();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the edited text on unmount, through the newest handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender, unmount } = render(<Harness onCommit={first} />);
    type(container, 'Hello world');
    rerender(<Harness onCommit={second} />);
    unmount();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Hello world', expect.any(Array));
  });
});
