// @vitest-environment jsdom

// The Assign Action dialog's per-open seed (docs/specs/012-collaboration/assigned-actions.md §2): create
// defaults the name to the element's text (focused + selected) and preselects Myself; an edit shows the
// current action with its assignee preselected; a new target re-seeds, never keeping the last attempt.

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementAction } from '@liveplanner/document';
import type { SaveActionInput } from '@/hooks/collab/useEditorActions';
import { AssignActionDialog } from './AssignActionDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/document/d1' }));

type Props = Parameters<typeof AssignActionDialog>[0];

const selfAction: ElementAction = {
  id: 'a1',
  name: 'Ship it',
  description: 'Before Friday',
  assignee: { userId: 'me', name: 'Ada' },
  teamId: null,
  assignerId: 'me',
  assignerName: 'Ada',
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
};

function props(over: Partial<Props> = {}): Props {
  return {
    open: true,
    existing: null,
    elementLabel: 'Retry budget',
    teams: [],
    ownerId: null,
    selfUserId: 'me',
    selfName: 'Ada',
    documentId: 'd1',
    documentTeamId: null,
    emailEnabled: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}

const nameInput = () => screen.getByPlaceholderText<HTMLInputElement>(/confirm the retry budget/i);
const myself = () => screen.getByRole('button', { name: /myself/i });

afterEach(() => cleanup());

describe('AssignActionDialog seed', () => {
  it('defaults the name to the element text, focused and selected, with Myself picked', () => {
    render(<AssignActionDialog {...props()} />);
    const input = nameInput();
    expect(input.value).toBe('Retry budget');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Retry budget'.length);
    expect(myself().getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the existing action with its self assignee preselected on edit', () => {
    render(<AssignActionDialog {...props({ existing: selfAction })} />);
    expect(nameInput().value).toBe('Ship it');
    expect(screen.getByDisplayValue('Before Friday')).toBeTruthy();
    expect(myself().getAttribute('aria-pressed')).toBe('true');
  });

  it('re-seeds for a new target, dropping the previous edits', () => {
    const { rerender } = render(<AssignActionDialog {...props()} />);
    fireEvent.change(nameInput(), { target: { value: 'typed' } });
    rerender(<AssignActionDialog {...props({ elementLabel: 'Other box' })} />);
    expect(nameInput().value).toBe('Other box');
  });

  it('keeps mid-typing edits when the identity settles late', () => {
    const { rerender } = render(<AssignActionDialog {...props({ selfName: null })} />);
    fireEvent.change(nameInput(), { target: { value: 'typed' } });
    rerender(<AssignActionDialog {...props({ selfName: 'Ada' })} />);
    expect(nameInput().value).toBe('typed');
  });

  it('re-seeds on reopen', () => {
    const { rerender } = render(<AssignActionDialog {...props()} />);
    fireEvent.change(nameInput(), { target: { value: 'typed' } });
    rerender(<AssignActionDialog {...props({ open: false })} />);
    rerender(<AssignActionDialog {...props()} />);
    expect(nameInput().value).toBe('Retry budget');
  });
});

// docs/specs/026-plan/linked-boards.md "On the canvas": an edit picks Open, Done or Won't Do, saved with the rest.
describe('AssignActionDialog status', () => {
  it('offers a status only when editing, and sends it only when it changed', () => {
    const onSubmit = vi.fn<(input: SaveActionInput) => void>();
    const { rerender } = render(<AssignActionDialog {...props({ onSubmit })} />);
    expect(screen.queryByRole('radiogroup', { name: 'Status' })).toBeNull();
    rerender(<AssignActionDialog {...props({ onSubmit, existing: selfAction })} />);
    expect(screen.getByRole('radio', { name: 'Open' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    expect(onSubmit.mock.calls[0]![0].status).toBeUndefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Won’t Do' }));
    fireEvent.click(screen.getByRole('button', { name: /save action/i }));
    expect(onSubmit.mock.calls[1]![0].status).toBe('wont-do');
  });
});
