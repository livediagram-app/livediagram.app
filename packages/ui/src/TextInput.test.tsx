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

  // Work Tracker 1171: a screen reader hears that a field is wrong, and why.
  it('tell a screen reader when invalid, and only then', () => {
    render(
      <>
        <TextInput aria-label="ok" />
        <TextInput aria-label="bad" invalid />
        <TextArea aria-label="bad note" invalid />
      </>,
    );
    expect(screen.getByLabelText('ok').hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByLabelText('bad').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('bad note').getAttribute('aria-invalid')).toBe('true');
  });

  it('keep a caller’s own aria-invalid over invalid', () => {
    render(
      <>
        <TextInput aria-label="own false" invalid aria-invalid={false} />
        <TextInput aria-label="own true" aria-invalid />
      </>,
    );
    expect(screen.getByLabelText('own false').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByLabelText('own true').getAttribute('aria-invalid')).toBe('true');
  });

  it('are described by their hint, joined after any ids the caller passed', () => {
    render(
      <>
        <TextInput aria-label="plain" />
        <TextInput aria-label="hinted" invalid hintId="why" />
        <TextInput aria-label="both" hintId="why" aria-describedby="count" />
        <TextInput aria-label="own only" aria-describedby="count" />
        <TextArea aria-label="note" hintId="why" />
        <p id="why">Not an email address or a domain.</p>
      </>,
    );
    expect(screen.getByLabelText('plain').hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByLabelText('hinted').getAttribute('aria-describedby')).toBe('why');
    expect(screen.getByLabelText('both').getAttribute('aria-describedby')).toBe('count why');
    expect(screen.getByLabelText('own only').getAttribute('aria-describedby')).toBe('count');
    expect(screen.getByLabelText('note').getAttribute('aria-describedby')).toBe('why');
    // Found the way a screen reader finds it: the field's description is the hint's text.
    expect(
      screen.getByRole('textbox', {
        name: 'hinted',
        description: 'Not an email address or a domain.',
      }),
    ).toBeTruthy();
  });
});
