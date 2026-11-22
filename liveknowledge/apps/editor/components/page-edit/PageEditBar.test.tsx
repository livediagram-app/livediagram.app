// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PageEditBarView, type PageEditBarViewProps } from './PageEditBar';

// docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX": Edit while reading; the draft bar while
// editing, with the others' faces, the status, Cancel and Save.

const props = (extra: Partial<PageEditBarViewProps> = {}): PageEditBarViewProps => ({
  editing: false,
  mayEdit: true,
  status: '',
  agentChanges: 0,
  others: [],
  onEdit: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  ...extra,
});

describe('the draft bar', () => {
  it('offers Edit while reading, to an Editor only', () => {
    const p = props();
    const { rerender, container } = render(<PageEditBarView {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(p.onEdit).toHaveBeenCalled();
    rerender(<PageEditBarView {...props({ mayEdit: false })} />);
    expect(container.innerHTML).toBe('');
  });

  // editing.md "The buttons" (owner 2026-11-21): Zen Mode to the right of Edit while reading, never while editing.
  it('offers Zen Mode right of Edit while reading, and not while editing', () => {
    const onZen = vi.fn();
    const { rerender } = render(<PageEditBarView {...props({ onZen })} />);
    const edit = screen.getByRole('button', { name: /Edit/ });
    const zen = screen.getByRole('button', { name: 'Zen Mode' });
    expect(edit.compareDocumentPosition(zen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(zen);
    expect(onZen).toHaveBeenCalled();
    rerender(<PageEditBarView {...props({ onZen, editing: true })} />);
    expect(screen.queryByRole('button', { name: 'Zen Mode' })).toBeNull();
    rerender(<PageEditBarView {...props()} />);
    expect(screen.queryByRole('button', { name: 'Zen Mode' })).toBeNull();
  });

  it('shows Cancel and Save while editing, and nothing to say while the draft is the saved page', () => {
    const p = props({ editing: true });
    render(<PageEditBarView {...p} />);
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onSave).toHaveBeenCalled();
    expect(p.onCancel).toHaveBeenCalled();
    expect(document.querySelector('[data-page-edit-status]')!.textContent).toBe(''); // No label and no status while the draft is the saved page.
  });

  it("says the status, who else is editing, and an agent's change", () => {
    render(
      <PageEditBarView
        {...props({
          editing: true,
          status: 'Unsaved changes from Priya, 2 hours ago',
          agentChanges: 3,
          others: [
            { id: 'p1', name: 'Priya', color: '#c00' },
            { id: 'p2', name: 'Sam', color: '#0c0' },
          ],
        })}
      />,
    );
    expect(screen.getAllByText('Unsaved changes from Priya, 2 hours ago')[0]).toBeTruthy();
    expect(screen.getByText('An agent changed the saved page')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Also editing: Priya and Sam' })).toBeTruthy();
  });
});
