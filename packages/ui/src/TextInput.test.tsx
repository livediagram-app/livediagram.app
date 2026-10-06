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
});
