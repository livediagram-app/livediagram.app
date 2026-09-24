// @vitest-environment jsdom

// The action panel (spec/146). Like the Comment panel's tests, most of what is
// worth pinning is that it reuses the ORDINARY `action` field and the ordinary
// spec/68 handlers rather than growing parallel ones.

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

describe('ActionPanelFace', () => {
  it('offers to set up an action when it has none', () => {
    const onConfigure = vi.fn();
    render(
      <ActionPanelFace element={card()} textColor="#000" selfId={null} onConfigure={onConfigure} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set Up Action' }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });

  it('shows the action and completes it through the handler it was given', () => {
    const onComplete = vi.fn();
    render(
      <ActionPanelFace
        element={withAction()}
        textColor="#000"
        selfId="u-sam"
        onConfigure={() => {}}
        onComplete={onComplete}
        onReopen={() => {}}
      />,
    );
    expect(screen.getByText('Confirm the retry budget')).toBeTruthy();
    expect(screen.getByText('Assigned to you')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('offers Reopen once done', () => {
    const onReopen = vi.fn();
    render(
      <ActionPanelFace
        element={withAction('done')}
        textColor="#000"
        selfId="someone-else"
        onComplete={() => {}}
        onReopen={onReopen}
      />,
    );
    expect(screen.getByText('Assigned to Sam')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onReopen).toHaveBeenCalledOnce();
  });

  it('renders readable but inert without handlers (read-only surfaces)', () => {
    render(<ActionPanelFace element={withAction()} textColor="#000" selfId={null} />);
    expect(screen.getByText('Confirm the retry budget')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
