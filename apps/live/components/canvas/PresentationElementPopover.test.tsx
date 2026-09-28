// @vitest-environment jsdom

// Presenting reads an element's detail (docs/specs/012-collaboration/presentation-mode.md), an Action panel's
// whole list included (docs/specs/012-collaboration/action-panel.md).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createElementAction, createShape, type ShapeElement } from '@livediagram/diagram';
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
  it('treats an Action panel with actions as readable, and an empty one as not', () => {
    const empty = createShape('action-card', 0, 0) as ShapeElement;
    expect(hasReadableDetail(empty)).toBe(false);
    expect(hasReadableDetail({ ...empty, actions: [action('One')] })).toBe(true);
  });

  it('lists every action on a card', () => {
    const card = {
      ...(createShape('action-card', 0, 0) as ShapeElement),
      actions: [action('Write the runbook'), action('Load test')],
    };
    render(<PresentationElementPopover element={card} at={{ x: 10, y: 10 }} onClose={() => {}} />);
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByText('Write the runbook')).toBeTruthy();
    expect(screen.getByText('Load test')).toBeTruthy();
  });
});
