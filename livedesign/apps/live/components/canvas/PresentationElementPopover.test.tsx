// @vitest-environment jsdom

// Presenting reads an element's detail (docs/specs/012-collaboration/presentation-mode.md), its assigned
// action included (docs/specs/012-collaboration/assigned-actions.md).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createElementAction, createShape } from '@livedesign/design';
import { hasReadableDetail, PresentationElementPopover } from './PresentationElementPopover';

afterEach(cleanup);

const action = (name: string) =>
  createElementAction({
    name,
    description: '',
    assignee: { userId: 'u', name: 'Sam' },
    teamId: null,
    assigner: { id: 'u', name: 'Sam' },
  });

describe('PresentationElementPopover', () => {
  it('treats an element with an assigned action as readable, and a bare one as not', () => {
    const empty = createShape('square', 0, 0);
    expect(hasReadableDetail(empty)).toBe(false);
    expect(hasReadableDetail({ ...empty, action: action('One') })).toBe(true);
  });

  it('shows the action assigned to an element', () => {
    const box = { ...createShape('square', 0, 0), action: action('Write the runbook') };
    render(<PresentationElementPopover element={box} at={{ x: 10, y: 10 }} onClose={() => {}} />);
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('Write the runbook')).toBeTruthy();
  });
});
