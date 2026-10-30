// @vitest-environment jsdom
import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeDigits, EMPTY_CODE, type CodeDigitsHandle, type CodeDigitsProps } from './CodeDigits';

function Harness(props: Omit<CodeDigitsProps, 'digits' | 'onDigits'>) {
  const [digits, setDigits] = useState<readonly string[]>(EMPTY_CODE);
  return <CodeDigits digits={digits} onDigits={setDigits} {...props} />;
}

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const values = () => boxes().map((b) => b.value);

describe('CodeDigits', () => {
  it('draws six numeric boxes in a named group, the first offering the emailed code', () => {
    render(<Harness label="Deletion code" />);
    expect(screen.getByRole('group', { name: 'Deletion code' })).toBeTruthy();
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]!.autocomplete).toBe('one-time-code');
    expect(boxes()[1]!.autocomplete).toBe('off');
    expect(boxes()[2]!.inputMode).toBe('numeric');
    expect(screen.getByLabelText('Digit 6')).toBeTruthy();
  });

  it('moves on as digits are typed, ignoring anything else, and hears the whole code', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0]!, { target: { value: 'a' } });
    expect(values()).toEqual(['', '', '', '', '', '']);
    '12345'.split('').forEach((d, i) => fireEvent.change(boxes()[i]!, { target: { value: d } }));
    expect(document.activeElement).toBe(boxes()[5]);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.change(boxes()[5]!, { target: { value: '6' } });
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('fills from the first box on a paste, and empties a box that is cleared', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[3]!, { clipboardData: { getData: () => '98 76 54 3' } });
    expect(values()).toEqual(['9', '8', '7', '6', '5', '4']);
    expect(onComplete).toHaveBeenCalledWith('987654');
    fireEvent.change(boxes()[2]!, { target: { value: '' } });
    expect(values()[2]).toBe('');
  });

  it('goes back a box on Backspace in an empty one', () => {
    render(<Harness />);
    fireEvent.change(boxes()[0]!, { target: { value: '1' } });
    fireEvent.keyDown(boxes()[1]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(boxes()[0]);
    fireEvent.keyDown(boxes()[0]!, { key: 'Backspace' });
    expect(document.activeElement).toBe(boxes()[0]);
  });

  it('focuses its first box on request, and marks every box when the code was wrong', () => {
    const ref = createRef<CodeDigitsHandle>();
    render(<Harness ref={ref} invalid disabled />);
    expect(boxes()[0]!.className).toContain('border-rose-400');
    expect(boxes()[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(boxes()[0]!.disabled).toBe(true);
    render(<Harness ref={ref} />);
    ref.current!.focus();
    expect(document.activeElement).toBe(boxes()[6]);
  });

  it('wears the look it is given', () => {
    render(<Harness boxClassName="site-field" />);
    expect(boxes()[0]!.className).toBe('site-field');
  });
});
