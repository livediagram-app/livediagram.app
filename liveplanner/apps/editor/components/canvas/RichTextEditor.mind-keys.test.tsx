// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { MindGrowProvider } from './MindGrowContext';
import { renderLabel } from './element-labels';
import { resetMindHandoff } from '@/lib/mind-handoff';

// docs/specs/009-elements/mind-node.md "Keyboard" and "New lines": in a mind node's label editor
// Enter commits and adds a sibling, Tab commits and adds a child, and Shift+Enter starts a new
// line in the label instead of growing the map.

const venue: ShapeElement = {
  ...createShape('mind-node', 0, 0),
  id: 'venue',
  label: 'Venue',
};

function editing(el: ShapeElement = venue) {
  const grow = vi.fn();
  const onCommit = vi.fn<Parameters<typeof renderLabel>[7]>();
  const onLiveText = vi.fn();
  render(
    <MindGrowProvider value={{ grow, abandon: () => false }}>
      {renderLabel(
        el,
        el.label ?? '',
        'md',
        'center',
        'middle',
        8,
        true,
        onCommit,
        () => {},
        true,
        undefined,
        undefined,
        false,
        undefined,
        onLiveText,
      )}
    </MindGrowProvider>,
  );
  const editor = screen.getByRole('textbox');
  return { grow, onCommit, onLiveText, editor };
}

const press = (editor: HTMLElement, key: string, shiftKey = false) => {
  let event!: boolean;
  act(() => {
    event = fireEvent.keyDown(editor, { key, shiftKey });
  });
  // fireEvent returns false when the handler prevented the default.
  return { prevented: !event };
};

afterEach(() => {
  cleanup();
  resetMindHandoff();
});

describe("a mind node's label editor", () => {
  it('Enter commits the label and grows a sibling', () => {
    const { grow, onCommit, editor } = editing();
    expect(press(editor, 'Enter').prevented).toBe(true);
    expect(onCommit).toHaveBeenCalledWith('Venue', expect.any(Array));
    expect(grow).toHaveBeenCalledExactlyOnceWith('venue', 'sibling');
  });

  it('Tab commits the label and grows a child', () => {
    const { grow, onCommit, editor } = editing();
    expect(press(editor, 'Tab').prevented).toBe(true);
    expect(onCommit).toHaveBeenCalledWith('Venue', expect.any(Array));
    expect(grow).toHaveBeenCalledExactlyOnceWith('venue', 'child');
  });

  it('Shift+Enter starts a new line in the label and grows nothing', () => {
    const { grow, onCommit, editor } = editing();
    expect(press(editor, 'Enter', true).prevented).toBe(true);
    expect(grow).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    // A real '\n' in the text, so the label stores it as written.
    expect(editor.textContent).toBe('Venue\n');
  });

  it('keeps the new line in the committed label, then grows on the next Enter', () => {
    const { grow, onCommit, editor } = editing();
    press(editor, 'Enter', true);
    press(editor, 'Enter');
    const [label, runs] = onCommit.mock.calls[0]!;
    expect(label).toBe('Venue\n');
    expect(runs.map((r: { text: string }) => r.text).join('')).toBe('Venue\n');
    expect(grow).toHaveBeenCalledExactlyOnceWith('venue', 'sibling');
  });

  it('reports its live text, so the node can grow to fit while typing', () => {
    const { onLiveText, editor } = editing();
    onLiveText.mockClear();
    press(editor, 'Enter', true);
    expect(onLiveText).toHaveBeenLastCalledWith(editor);
  });
});
