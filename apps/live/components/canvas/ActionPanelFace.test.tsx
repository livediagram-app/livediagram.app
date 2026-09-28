// @vitest-environment jsdom

// The action panel (docs/specs/012-collaboration/action-panel.md). Like the Comment panel's tests, most of what is
// worth pinning is that it reuses the ORDINARY `action` field and the ordinary
// docs/specs/012-collaboration/assigned-actions.md handlers rather than growing parallel ones.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SELF_PAINTING_SHAPES,
  SHAPE_KINDS,
  createElementAction,
  createShape,
  isOpenAction,
  isVotable,
  type ShapeElement,
} from '@livediagram/diagram';

import { ActionPanelFace } from './ActionPanelFace';

afterEach(cleanup);

const card = () => createShape('action-card', 0, 0) as ShapeElement;

const withAction = (status: 'open' | 'done' = 'open'): ShapeElement => ({
  ...card(),
  action: {
    ...createElementAction({
      name: 'Confirm the retry budget',
      description: 'Ask the platform team',
      assignee: { userId: 'u-sam', name: 'Sam' },
      teamId: null,
      assigner: { id: 'u-alex', name: 'Alex' },
    }),
    status,
  },
});

describe('action panel registration', () => {
  it('is a registered, card-shaped kind that is not a vote candidate', () => {
    expect(SHAPE_KINDS.has('action-card')).toBe(true);
    expect(SELF_PAINTING_SHAPES.has('action-card')).toBe(false);
    expect(isVotable(card())).toBe(false);
  });

  it('starts unlabelled, so the dialog does not name every action after it', () => {
    expect(card().label).toBe('');
  });

  it('carries an ordinary action, read by the ordinary helper', () => {
    expect(isOpenAction(withAction().action)).toBe(true);
    expect(isOpenAction(withAction('done').action)).toBe(false);
  });
});

describe('ActionPanelFace (docs/specs/012-collaboration/action-panel.md "The card")', () => {
  const second = (status: 'open' | 'done' = 'open') => ({
    ...createElementAction({
      name: 'Load test the queue',
      description: '',
      assignee: { userId: 'u-priya', name: 'Priya' },
      teamId: null,
      assigner: { id: 'u-alex', name: 'Alex' },
    }),
    status,
  });
  const listCard = (...actions: ReturnType<typeof second>[]): ShapeElement => ({
    ...card(),
    actions,
  });

  it('offers to add the first action when it has none', () => {
    const onAdd = vi.fn();
    render(<ActionPanelFace element={card()} textColor="#000" selfId={null} onAdd={onAdd} />);
    expect(screen.getByText('No Actions Yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('lists every action, and completes the one whose check is pressed', () => {
    const a = second();
    const b = { ...second(), name: 'Write the runbook' };
    const onComplete = vi.fn();
    render(
      <ActionPanelFace
        element={listCard(a, b)}
        textColor="#000"
        selfId="u-priya"
        onComplete={onComplete}
        onReopen={() => {}}
      />,
    );
    expect(screen.getByText('Load test the queue')).toBeTruthy();
    expect(screen.getByText('Write the runbook')).toBeTruthy();
    expect(screen.getByText('2 open')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Complete Write the runbook' }));
    expect(onComplete).toHaveBeenCalledWith(b.id);
  });

  it('reads a card saved with a single action as a one-item list', () => {
    render(<ActionPanelFace element={withAction()} textColor="#000" selfId="u-sam" />);
    expect(screen.getByText('Confirm the retry budget')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('reopens a done action, edits on the row, and adds another from the bar', () => {
    const done = second('done');
    const onReopen = vi.fn();
    const onEdit = vi.fn();
    const onAdd = vi.fn();
    render(
      <ActionPanelFace
        element={listCard(done)}
        textColor="#000"
        selfId={null}
        onReopen={onReopen}
        onEdit={onEdit}
        onAdd={onAdd}
      />,
    );
    expect(screen.getByText('All Done')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Load test the queue' }));
    expect(onReopen).toHaveBeenCalledWith(done.id);
    fireEvent.click(screen.getByText('Load test the queue'));
    expect(onEdit).toHaveBeenCalledWith(done.id);
    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders readable but inert without handlers (read-only surfaces)', () => {
    render(<ActionPanelFace element={listCard(second())} textColor="#000" selfId={null} />);
    expect(screen.getByText('Load test the queue')).toBeTruthy();
    for (const b of screen.queryAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});
