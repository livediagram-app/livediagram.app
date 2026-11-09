// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cancelsCanvasSelectStart, useNoCanvasTextSelection } from './useNoCanvasTextSelection';

// Each editor's docs/specs/008-canvas/canvas-performance.md "A press on the canvas selects no text".
afterEach(cleanup);

function Surface() {
  const ref = useRef<HTMLElement>(null);
  useNoCanvasTextSelection(ref);
  return (
    <main ref={ref} data-testid="surface">
      <div data-testid="box">Box label</div>
      <div contentEditable suppressContentEditableWarning data-testid="editor">
        Editing
      </div>
      <input data-testid="field" />
      <span className="select-text" data-testid="opt-in">
        Copy me
      </span>
    </main>
  );
}

const selectStart = (target: EventTarget) => {
  const e = new Event('selectstart', { bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('the canvas selects no text', () => {
  it('cancels a selection starting on the board, on an element or its text', () => {
    const { getByTestId } = render(<Surface />);
    expect(selectStart(getByTestId('surface'))).toBe(true);
    expect(selectStart(getByTestId('box'))).toBe(true);
    expect(selectStart(getByTestId('box').firstChild!)).toBe(true);
  });

  it('leaves a selection alone where text is typed or an element opts in', () => {
    const { getByTestId } = render(<Surface />);
    expect(selectStart(getByTestId('editor').firstChild!)).toBe(false);
    expect(selectStart(getByTestId('field'))).toBe(false);
    expect(selectStart(getByTestId('opt-in').firstChild!)).toBe(false);
  });

  it('stops listening when the canvas goes', () => {
    const { getByTestId, unmount } = render(<Surface />);
    const surface = getByTestId('surface');
    unmount();
    expect(selectStart(surface)).toBe(false);
  });

  it('reads a missing target as the canvas', () => {
    expect(cancelsCanvasSelectStart(null)).toBe(true);
  });

  it('does nothing without a surface, or with a callback ref', () => {
    function Bare() {
      const ref = useRef<HTMLElement>(null);
      useNoCanvasTextSelection(ref);
      useNoCanvasTextSelection(() => {});
      useNoCanvasTextSelection(null);
      return null;
    }
    expect(() => render(<Bare />)).not.toThrow();
  });
});
