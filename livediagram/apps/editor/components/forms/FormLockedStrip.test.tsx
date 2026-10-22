// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormLockedStrip } from './FormLockedStrip';

// A live form's lock (docs/specs/030-forms/forms.md "A live form is locked"): the strip says why, and Edit Form
// stops the form taking responses.

afterEach(cleanup);

describe('FormLockedStrip', () => {
  it('says the form is locked and Edit Form stops it taking responses', () => {
    const onEdit = vi.fn();
    render(<FormLockedStrip onEdit={onEdit} busy={false} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Taking responses, so it can’t be changed.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Form' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('holds Edit Form while the link is busy', () => {
    render(<FormLockedStrip onEdit={() => {}} busy />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit Form' }).disabled).toBe(
      true,
    );
  });
});
