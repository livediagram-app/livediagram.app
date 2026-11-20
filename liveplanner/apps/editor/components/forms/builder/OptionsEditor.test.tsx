// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormQuestion } from '@liveplanner/forms';
import { OptionsEditor } from './OptionsEditor';

// A choice's options move by their grips (docs/specs/030-forms/forms.md "Question types", options).

afterEach(cleanup);

const Q: FormQuestion = { id: 'q', type: 'single', prompt: 'Size', options: ['S', 'M', 'L'] };

function setup(question: FormQuestion = Q) {
  const onOptions = vi.fn();
  const view = render(
    <OptionsEditor question={question} onOptions={onOptions} onOther={() => {}} />,
  );
  // Rows 40 px apart, each 36 px tall, the list starting at the page's top.
  view.container.querySelectorAll<HTMLElement>('[data-form-option]').forEach((row, i) => {
    row.getBoundingClientRect = () =>
      ({
        top: i * 40,
        bottom: i * 40 + 36,
        left: 0,
        right: 300,
        width: 300,
        height: 36,
      }) as DOMRect;
  });
  return { onOptions, ...view };
}

const grip = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}: Drag to Reorder`) });
const pointer = (type: string, clientY: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientY, bubbles: true }));
  });

describe('OptionsEditor grips', () => {
  it('drops a dragged option where its line is', () => {
    const { onOptions, container } = setup();
    fireEvent.pointerDown(grip('S'), { button: 0 });
    pointer('pointermove', 100);
    // The line is drawn at the gap, after M.
    expect(container.querySelector('[role="list"] > span[aria-hidden]')).toBeTruthy();
    pointer('pointerup', 100);
    expect(onOptions).toHaveBeenCalledWith(['M', 'L', 'S']);
    expect(container.querySelector('[role="list"] > span[aria-hidden]')).toBeNull();
  });

  it('changes nothing when dropped where it was, or let go without moving', () => {
    const { onOptions } = setup();
    fireEvent.pointerDown(grip('M'), { button: 0 });
    pointer('pointermove', 45);
    pointer('pointerup', 45);
    fireEvent.pointerDown(grip('M'), { button: 0 });
    pointer('pointerup', 0);
    expect(onOptions).not.toHaveBeenCalled();
  });

  it('cancels on Escape without closing the question, and on a cancelled pointer', () => {
    const { onOptions } = setup();
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    fireEvent.pointerDown(grip('S'), { button: 0 });
    pointer('pointermove', 100);
    fireEvent.keyDown(grip('S'), { key: 'Escape' });
    pointer('pointerup', 100);
    expect(outer).not.toHaveBeenCalled();
    // Any other key passes.
    fireEvent.pointerDown(grip('S'), { button: 0 });
    fireEvent.keyDown(grip('S'), { key: 'a' });
    expect(outer).toHaveBeenCalledTimes(1);
    pointer('pointermove', 100);
    pointer('pointercancel', 100);
    window.removeEventListener('keydown', outer);
    expect(onOptions).not.toHaveBeenCalled();
  });

  it('ignores a press that is not the main button', () => {
    const { onOptions } = setup();
    fireEvent.pointerDown(grip('S'), { button: 2 });
    pointer('pointermove', 100);
    pointer('pointerup', 100);
    expect(onOptions).not.toHaveBeenCalled();
  });

  it('moves an option with the arrow keys on its grip, stopping at the ends', () => {
    const { onOptions } = setup();
    fireEvent.keyDown(grip('S'), { key: 'ArrowDown' });
    expect(onOptions).toHaveBeenLastCalledWith(['M', 'S', 'L']);
    // The next move builds on the first, before the list is drawn again.
    fireEvent.keyDown(grip('L'), { key: 'ArrowUp' });
    expect(onOptions).toHaveBeenLastCalledWith(['M', 'L', 'S']);
    onOptions.mockClear();
    fireEvent.keyDown(grip('S'), { key: 'ArrowUp' });
    fireEvent.keyDown(grip('L'), { key: 'ArrowDown' });
    fireEvent.keyDown(grip('M'), { key: 'Enter' });
    expect(onOptions).not.toHaveBeenCalled();
  });

  it('keeps focus on the grip of the option it moved', () => {
    const onOptions = vi.fn();
    const { rerender } = render(
      <OptionsEditor question={Q} onOptions={onOptions} onOther={() => {}} />,
    );
    fireEvent.keyDown(grip('S'), { key: 'ArrowDown' });
    rerender(
      <OptionsEditor
        question={{ ...Q, options: ['M', 'S', 'L'] }}
        onOptions={onOptions}
        onOther={() => {}}
      />,
    );
    expect(document.activeElement).toBe(grip('S'));
  });

  it('draws no grip for a lone option', () => {
    setup({ ...Q, options: ['Only'] });
    expect(screen.queryByRole('button', { name: /Drag to Reorder/ })).toBeNull();
  });
});

// One key can change the options twice before the next draw. Each change must build on the one before it.
describe('OptionsEditor, a name typed and a key pressed straight after', () => {
  let now: string[] = [];
  function Held() {
    const [options, setOptions] = useState(['Option 1', 'Option 2']);
    now = options;
    return <OptionsEditor question={{ ...Q, options }} onOptions={setOptions} onOther={() => {}} />;
  }
  const box = (n: number) => screen.getByRole('textbox', { name: `Option ${n}` });

  it('keeps the name when Enter adds the next option before the typing has been saved', () => {
    render(<Held />);
    fireEvent.change(box(2), { target: { value: 'Phone' } });
    fireEvent.keyDown(box(2), { key: 'Enter' });
    expect(now).toEqual(['Option 1', 'Phone', 'Option 3']);
    expect(document.activeElement).toBe(box(3));
  });

  it('keeps the name with its option when Alt and an arrow move it before the typing has been saved', () => {
    vi.useFakeTimers();
    render(<Held />);
    fireEvent.change(box(1), { target: { value: 'Email' } });
    fireEvent.keyDown(box(1), { key: 'ArrowDown', altKey: true });
    expect(now).toEqual(['Option 2', 'Email']);
    // The save its typing had pending renames nothing afterwards.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();
    expect(now).toEqual(['Option 2', 'Email']);
  });

  it('removes an emptied option with Backspace and pastes one option a line', () => {
    render(<Held />);
    fireEvent.change(box(2), { target: { value: '' } });
    fireEvent.keyDown(box(2), { key: 'Backspace' });
    expect(now).toEqual(['Option 1']);
    fireEvent.paste(box(1), { clipboardData: { getData: () => 'Red\nGreen\nBlue' } });
    expect(now).toContain('Green');
    expect(now).toContain('Blue');
  });
});
