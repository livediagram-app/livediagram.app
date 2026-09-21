// @vitest-environment jsdom

// The one component in this folder with a render test (spec/138 §11):
// the menu slot is the one place a card's click and a child's click
// compete, and that can only be checked by rendering both.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimelineCard } from './TimelineCard';
import type { TimelineEvent } from './types';

function event(over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'e1',
    sourceType: 'diagram',
    sourceId: 'd1',
    eventType: 'diagram_created',
    title: 'Diagram Created',
    description: null,
    occurredAt: new Date(2026, 8, 21, 7, 22).getTime(),
    actorId: 'me',
    snapshot: { diagramId: 'd1', diagramName: 'Payments' },
    ...over,
  } as TimelineEvent;
}

const icon = <svg data-testid="glyph" />;

describe('TimelineCard', () => {
  it('titles the card with the subject and gives the stored category as the reason', () => {
    render(<TimelineCard event={event()} rendered={{ icon, subject: 'Payments' }} />);
    expect(screen.getByText('Payments')).toBeTruthy();
    expect(screen.getByText('Diagram Created')).toBeTruthy();
  });

  it('falls back to the stored title as the subject', () => {
    render(<TimelineCard event={event()} rendered={{ icon }} />);
    expect(screen.getAllByText('Diagram Created')).toHaveLength(2);
  });

  it('shows the glyph box when there is no preview, and the preview when there is', () => {
    const { rerender } = render(<TimelineCard event={event()} rendered={{ icon }} />);
    // Once large in the preview box, once small in the reason line.
    expect(screen.getAllByTestId('glyph')).toHaveLength(2);

    rerender(
      <TimelineCard
        event={event()}
        rendered={{ icon, preview: <img alt="snapshot" src="data:," /> }}
      />,
    );
    expect(screen.getByAltText('snapshot')).toBeTruthy();
    expect(screen.getAllByTestId('glyph')).toHaveLength(1);
  });

  it('renders the menu slot, and a click there does not open the card', () => {
    const onClick = vi.fn();
    const onMenu = vi.fn();
    render(
      <TimelineCard
        event={event()}
        rendered={{ icon, subject: 'Payments', onClick }}
        slots={{
          menu: (
            <button type="button" onClick={onMenu}>
              Menu
            </button>
          ),
        }}
      />,
    );
    fireEvent.click(screen.getByText('Menu'));
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Payments'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('replaces the subject with the title slot and keeps its keys off the card', () => {
    const onClick = vi.fn();
    render(
      <TimelineCard
        event={event()}
        rendered={{ icon, subject: 'Payments', onClick }}
        slots={{ title: <input aria-label="Rename" defaultValue="Payments" /> }}
      />,
    );
    expect(screen.queryByText('Payments')).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('Rename'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('prefers the host’s current subject and hands right-click to the host', () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <TimelineCard
        event={event()}
        rendered={{ icon, subject: 'Payments' }}
        slots={{ subject: 'Payments v2', onContextMenu }}
      />,
    );
    expect(screen.getByText('Payments v2')).toBeTruthy();
    expect(screen.queryByText('Payments')).toBeNull();
    fireEvent.contextMenu(container.querySelector('[data-timeline-event="e1"]')!);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it('is dimmed and inert when there is nowhere to go', () => {
    const { container } = render(<TimelineCard event={event()} rendered={{ icon }} />);
    const card = container.querySelector('[data-timeline-event="e1"]')!;
    expect(card.className).toContain('opacity-60');
    expect(card.getAttribute('role')).toBeNull();
  });
});
