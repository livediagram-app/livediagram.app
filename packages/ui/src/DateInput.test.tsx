// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateInput, dateCommit, isWholeDay, openDatePicker } from './DateInput';

afterEach(cleanup);

// The browser's `validity.badInput`: some segments typed, others empty. jsdom never sets it.
function partial(el: HTMLInputElement, on: boolean) {
  Object.defineProperty(el, 'validity', { value: { badInput: on }, configurable: true });
}

const field = () => screen.getByLabelText('Due') as HTMLInputElement;

describe('isWholeDay', () => {
  it('takes a real day with a four-digit year', () => {
    expect(isWholeDay('2026-10-30')).toBe(true);
    expect(isWholeDay('1000-01-01')).toBe(true);
    expect(isWholeDay('2028-02-29')).toBe(true);
  });

  it('refuses a year still being typed, a day that does not exist, and other shapes', () => {
    expect(isWholeDay('0002-10-30')).toBe(false);
    expect(isWholeDay('0202-10-30')).toBe(false);
    expect(isWholeDay('2026-04-31')).toBe(false);
    expect(isWholeDay('2027-02-29')).toBe(false);
    expect(isWholeDay('20261-10-30')).toBe(false);
    expect(isWholeDay('30/10/2026')).toBe(false);
  });
});

describe('dateCommit', () => {
  it('saves a whole day, clears an emptied field, and waits on a part-typed one', () => {
    expect(dateCommit('2026-10-30', false)).toEqual({ kind: 'set', day: '2026-10-30' });
    expect(dateCommit('', false)).toEqual({ kind: 'clear' });
    expect(dateCommit('', true)).toEqual({ kind: 'wait' });
    expect(dateCommit('0020-10-30', false)).toEqual({ kind: 'wait' });
  });
});

describe('DateInput', () => {
  it('saves only the whole year when 30/10/2026 is typed a digit at a time', () => {
    const onCommit = vi.fn();
    render(<DateInput aria-label="Due" value={undefined} onCommit={onCommit} />);
    const el = field();
    partial(el, true);
    // Day and month typed, year still empty: reads as ''.
    fireEvent.change(el, { target: { value: '' } });
    partial(el, false);
    for (const v of ['0002-10-30', '0020-10-30', '0202-10-30']) {
      fireEvent.change(el, { target: { value: v } });
    }
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(el, { target: { value: '2026-10-30' } });
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith('2026-10-30');
  });

  it('never clears a saved date while a segment is being retyped', () => {
    const onCommit = vi.fn();
    render(<DateInput aria-label="Due" value="2026-10-30" onCommit={onCommit} />);
    const el = field();
    partial(el, true);
    fireEvent.change(el, { target: { value: '' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears the date when every segment is emptied', () => {
    const onCommit = vi.fn();
    render(<DateInput aria-label="Due" value="2026-10-30" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '' } });
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it('does not save the date it already holds', () => {
    const onCommit = vi.fn();
    render(<DateInput aria-label="Due" value="2026-10-30" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '2026-10-30' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('puts the saved date back when a short year is left', () => {
    const onBlur = vi.fn();
    render(<DateInput aria-label="Due" value="2026-10-30" onCommit={vi.fn()} onBlur={onBlur} />);
    const el = field();
    fireEvent.change(el, { target: { value: '0020-10-30' } });
    fireEvent.blur(el);
    expect(el.value).toBe('2026-10-30');
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('drops a part-typed date for a fresh field on blur, and on Escape keeps focus', () => {
    const onKeyDown = vi.fn();
    render(
      <DateInput aria-label="Due" value="2026-10-30" onCommit={vi.fn()} onKeyDown={onKeyDown} />,
    );
    const first = field();
    partial(first, true);
    fireEvent.blur(first);
    const second = field();
    expect(second).not.toBe(first);
    expect(second.value).toBe('2026-10-30');

    second.focus();
    partial(second, true);
    fireEvent.keyDown(second, { key: 'Escape' });
    const third = field();
    expect(third).not.toBe(second);
    expect(document.activeElement).toBe(third);
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('keeps the Escape that undoes typing from a listener on the node React listens on', () => {
    // Under Next, React's root is `document`, where a Dialog listens for Escape too.
    const { container } = render(
      <DateInput aria-label="Due" value="2026-10-30" onCommit={vi.fn()} />,
    );
    const dialogEscape = vi.fn();
    container.addEventListener('keydown', dialogEscape);
    const el = field();
    el.focus();
    partial(el, true);
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(dialogEscape).not.toHaveBeenCalled();
    container.removeEventListener('keydown', dialogEscape);
  });

  it('lets an Escape with nothing typed through to whatever holds the field', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <DateInput aria-label="Due" value="2026-10-30" onCommit={vi.fn()} />
      </div>,
    );
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(outer).toHaveBeenCalledOnce();
  });

  it('shows a change from elsewhere, except while it is being typed in', () => {
    const { rerender } = render(
      <DateInput aria-label="Due" value="2026-10-30" onCommit={vi.fn()} />,
    );
    const el = field();
    rerender(<DateInput aria-label="Due" value="2026-11-02" onCommit={vi.fn()} />);
    expect(el.value).toBe('2026-11-02');
    el.focus();
    fireEvent.change(el, { target: { value: '0002-11-02' } });
    rerender(<DateInput aria-label="Due" value="2026-12-25" onCommit={vi.fn()} />);
    expect(el.value).toBe('0002-11-02');
  });

  it('takes only the classes it is given when unstyled', () => {
    render(
      <DateInput
        aria-label="Due"
        unstyled
        className="dense"
        value={undefined}
        onCommit={vi.fn()}
      />,
    );
    expect(field().className).toBe('dense');
    expect(field().type).toBe('date');
  });

  it('caps the year at four digits', () => {
    render(<DateInput aria-label="Due" value={undefined} onCommit={vi.fn()} />);
    expect(field().min).toBe('1000-01-01');
    expect(field().max).toBe('9999-12-31');
  });
});

describe('openDatePicker', () => {
  it('opens the system picker where the browser has one', () => {
    const el = document.createElement('input');
    const showPicker = vi.fn();
    Object.defineProperty(el, 'showPicker', { value: showPicker });
    openDatePicker(el);
    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('focuses the field where the picker is missing or refused', () => {
    const missing = document.createElement('input');
    Object.defineProperty(missing, 'showPicker', { value: undefined });
    const refused = document.createElement('input');
    Object.defineProperty(refused, 'showPicker', {
      value: () => {
        throw new DOMException('No gesture', 'NotAllowedError');
      },
    });
    document.body.append(missing, refused);
    openDatePicker(missing);
    expect(document.activeElement).toBe(missing);
    openDatePicker(refused);
    expect(document.activeElement).toBe(refused);
    missing.remove();
    refused.remove();
  });
});
