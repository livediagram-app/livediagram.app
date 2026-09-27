// @vitest-environment jsdom

// The team form's per-open seed (docs/specs/013-workspace/teams.md): each open shows the current
// values (or empty for a new team) with the name focused; a caller re-render that hands the same
// values in a fresh object never wipes what the user is typing.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamFormModal } from './TeamFormModal';

type Props = Parameters<typeof TeamFormModal>[0];

function props(over: Partial<Props> = {}): Props {
  return {
    open: true,
    title: 'Edit Team',
    submitLabel: 'Save',
    initial: { name: 'Platform', organisation: 'ACME' },
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

const nameInput = () => screen.getByPlaceholderText(/platform squad/i) as HTMLInputElement;
const orgInput = () => screen.getByPlaceholderText(/acme corp/i) as HTMLInputElement;

afterEach(() => cleanup());

describe('TeamFormModal seed', () => {
  it('shows the current values with the name focused', () => {
    render(<TeamFormModal {...props()} />);
    expect(nameInput().value).toBe('Platform');
    expect(orgInput().value).toBe('ACME');
    expect(document.activeElement).toBe(nameInput());
  });

  it('keeps typing when the caller re-renders with equal values in a new object', () => {
    const { rerender } = render(<TeamFormModal {...props()} />);
    fireEvent.change(nameInput(), { target: { value: 'Typed' } });
    rerender(<TeamFormModal {...props({ initial: { name: 'Platform', organisation: 'ACME' } })} />);
    expect(nameInput().value).toBe('Typed');
  });

  it('re-seeds on reopen, dropping the previous attempt', () => {
    const { rerender } = render(<TeamFormModal {...props({ initial: undefined })} />);
    fireEvent.change(nameInput(), { target: { value: 'Typed' } });
    rerender(<TeamFormModal {...props({ open: false, initial: undefined })} />);
    rerender(<TeamFormModal {...props({ initial: undefined })} />);
    expect(nameInput().value).toBe('');
  });

  it('re-seeds when the values change while open', () => {
    const { rerender } = render(<TeamFormModal {...props()} />);
    rerender(<TeamFormModal {...props({ initial: { name: 'Renamed', organisation: null } })} />);
    expect(nameInput().value).toBe('Renamed');
    expect(orgInput().value).toBe('');
  });
});
