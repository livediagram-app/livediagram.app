// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ElementAction } from '@livedocuments/document';
import { ActionPopover } from './ActionPopover';

// The assigned action's card (docs/specs/012-collaboration/assigned-actions.md): a dialog a screen reader can
// name, with no second banner landmark inside it.

const noop = () => {};
const action: ElementAction = {
  id: 'act',
  name: 'Confirm the budget',
  description: '',
  assignee: { userId: 'u1', name: 'Sam Lee' },
  teamId: null,
  assignerId: 'u2',
  assignerName: 'Ann',
  status: 'open',
  createdAt: 0,
  updatedAt: 0,
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ActionPopover', () => {
  it('is a dialog named by its title, with no banner landmark inside', () => {
    const anchor = document.createElement('div');
    anchor.dataset.elementId = 'a';
    document.body.appendChild(anchor);
    render(
      <ActionPopover
        elementId="a"
        action={action}
        onComplete={noop}
        onReopen={noop}
        onEdit={noop}
        onDelete={noop}
        onClose={noop}
        selfUserId={null}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Action' });
    expect(dialog.querySelector('header')).toBeNull();
  });
});
