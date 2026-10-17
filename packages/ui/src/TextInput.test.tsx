// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FIELD_INVALID, TextArea, TextInput } from './TextInput';

afterEach(cleanup);

describe('the shared text fields', () => {
  it('swap the border for the problem treatment when invalid, never stacking two', () => {
    render(
      <>
        <TextInput aria-label="ok" />
        <TextInput aria-label="bad" invalid />
        <TextArea aria-label="note" invalid className="resize-none" />
      </>,
    );
    const ok = screen.getByLabelText('ok').className;
    const bad = screen.getByLabelText('bad').className;
    const note = screen.getByLabelText('note');
    expect(ok).toContain('border-slate-200');
    expect(ok).not.toContain('border-rose-400');
    expect(bad).toContain(FIELD_INVALID);
    expect(bad).not.toContain('border-slate-200');
    expect(note.tagName).toBe('TEXTAREA');
    expect(note.className).toContain('resize-none');
    expect(note.className).toContain(FIELD_INVALID);
  });

  it('take the denser form rhythm when compact, keeping the border and focus ring', () => {
    render(<TextInput aria-label="compact" compact />);
    const field = screen.getByLabelText('compact');
    expect(field.className).toContain('py-1.5');
    expect(field.className).not.toContain('py-2');
    expect(field.className).toContain('focus:ring-2');
  });

  it('read as disabled when disabled, so a field nobody may change never looks editable', () => {
    render(
      <>
        <TextInput aria-label="locked" disabled />
        <TextArea aria-label="locked note" disabled />
      </>,
    );
    for (const label of ['locked', 'locked note']) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveProperty('disabled', true);
      expect(field.className).toContain('disabled:bg-slate-50');
      expect(field.className).toContain('disabled:cursor-not-allowed');
    }
  });
});
