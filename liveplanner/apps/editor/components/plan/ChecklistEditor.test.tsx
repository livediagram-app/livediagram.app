// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChecklistEditor } from './item-field-editors';

// docs/specs/026-plan/plan-board.md "Checklist" (Work Tracker 1514): a long step wraps rather than scrolling inside its
// row: its text is a growing textarea (and plain wrapped text read-only), breaking a long URL; Enter saves it, and a
// line break pasted in becomes a space.
afterEach(cleanup);

const LONG = `Read https://example.com/${'a'.repeat(120)} before the review`;
const rows = [
  { text: 'Short step', done: false },
  { text: LONG, done: true },
];

function list(disabled = false, onSave = vi.fn()) {
  render(<ChecklistEditor value={rows} disabled={disabled} onSave={onSave} />);
  return onSave;
}

describe('a checklist step', () => {
  it('is a one-line textarea that wraps, never a sideways-scrolling input', () => {
    list();
    const step = screen.getByRole('textbox', { name: 'Step 2' });
    expect(step.tagName).toBe('TEXTAREA');
    expect(step.getAttribute('rows')).toBe('1');
    expect(step.className).toContain('[overflow-wrap:anywhere]');
    expect(step.className).toContain('resize-none');
    expect((step as HTMLTextAreaElement).value).toBe(LONG);
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });

  it('centres the box and the × against the whole wrapped step', () => {
    list();
    const row = screen.getByRole('textbox', { name: 'Step 2' }).closest('li')!;
    expect(row.className).toContain('items-center');
    expect(screen.getByRole('button', { name: `Remove ${LONG}` }).className).toContain('shrink-0');
  });

  it('saves on Enter, turning a pasted line break into a space', () => {
    const onSave = list();
    const step = screen.getByRole('textbox', { name: 'Step 1' });
    step.focus();
    fireEvent.change(step, { target: { value: 'Two\nlines' } });
    expect((step as HTMLTextAreaElement).value).toBe('Two lines');
    fireEvent.keyDown(step, { key: 'Enter' });
    fireEvent.blur(step);
    expect(onSave).toHaveBeenCalledWith([{ text: 'Two lines', done: false }, rows[1]]);
  });

  it('leaves Enter alone while an input method is composing', () => {
    list();
    const step = screen.getByRole('textbox', { name: 'Step 1' });
    const ok = fireEvent.keyDown(step, { key: 'Enter', isComposing: true });
    expect(ok).toBe(true);
  });

  it('cancels a step edit on Escape and keeps the key from the card panel', () => {
    const onSave = list();
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    const step = screen.getByRole('textbox', { name: 'Step 1' });
    step.focus();
    fireEvent.change(step, { target: { value: 'Half typed' } });
    fireEvent.keyDown(step, { key: 'Escape' });
    document.removeEventListener('keydown', behind);
    expect(behind).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(step);
    expect((step as HTMLTextAreaElement).value).toBe('Short step');
    expect(onSave).not.toHaveBeenCalled();
    // A later edit saves as ever.
    fireEvent.change(step, { target: { value: 'Edited' } });
    fireEvent.blur(step);
    expect(onSave).toHaveBeenCalledWith([{ text: 'Edited', done: false }, rows[1]]);
  });

  it('leaves Add a step on Escape, its text kept, the key going no further', () => {
    list();
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    const add = screen.getByRole('textbox', { name: 'Add a step' });
    add.focus();
    fireEvent.change(add, { target: { value: 'Draft' } });
    fireEvent.keyDown(add, { key: 'Escape' });
    document.removeEventListener('keydown', behind);
    expect(behind).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(add);
    expect((add as HTMLInputElement).value).toBe('Draft');
  });

  it('takes a step off when its text is emptied, and saves nothing when unchanged', () => {
    const onSave = list();
    const step = screen.getByRole('textbox', { name: 'Step 1' });
    fireEvent.blur(step);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(step, { target: { value: '  ' } });
    fireEvent.blur(step);
    expect(onSave).toHaveBeenCalledWith([rows[1]]);
  });

  it('reads as wrapped text to someone who may not edit', () => {
    list(true);
    expect(screen.queryByRole('textbox')).toBeNull();
    const text = screen.getByText(LONG);
    expect(text.tagName).toBe('SPAN');
    expect(text.className).toContain('[overflow-wrap:anywhere]');
    expect(text.className).toContain('line-through');
  });

  it('ticks, removes and adds steps as before', () => {
    const onSave = list();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Short step' }));
    expect(onSave).toHaveBeenLastCalledWith([{ text: 'Short step', done: true }, rows[1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Short step' }));
    expect(onSave).toHaveBeenLastCalledWith([rows[1]]);
    const add = screen.getByRole('textbox', { name: 'Add a step' });
    fireEvent.change(add, { target: { value: ' Next ' } });
    fireEvent.keyDown(add, { key: 'Enter' });
    expect(onSave).toHaveBeenLastCalledWith([...rows, { text: 'Next', done: false }]);
  });

  it('says No steps, read-only and empty', () => {
    render(<ChecklistEditor value={undefined} disabled onSave={vi.fn()} />);
    expect(screen.getByText('No steps')).toBeTruthy();
  });
});
