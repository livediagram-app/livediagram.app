// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StackedCard } from './StackedCard';
import type { TimelineStack } from './stacking';
import type { TimelineEvent } from './types';

function event(id: string, name: string): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: id,
    eventType: 'diagram_renamed',
    title: 'Diagram Renamed',
    description: null,
    occurredAt: 1_700_000_000_000,
    actorId: 'me',
    snapshot: { diagramId: id, diagramName: name },
  } as TimelineEvent;
}

const stack: TimelineStack = {
  key: 'a',
  bucket: 'diagram::diagram_renamed',
  events: [event('a', 'Payments'), event('b', 'Search'), event('c', 'Inventory')],
};

const registry = {
  diagram: (e: TimelineEvent) => ({ icon: <svg />, subject: String(e.snapshot['diagramName']) }),
};

describe('StackedCard', () => {
  it('wears the generic headline and the count, never one member’s name', () => {
    render(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('Diagrams Renamed')).toBeTruthy();
    expect(screen.getByText('3 events · click to expand')).toBeTruthy();
    expect(screen.queryByText('Payments')).toBeNull();
  });

  it('is the same control open and closed: the reason line flips and the click toggles', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('Diagrams Renamed'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={onToggle}
        expanded
      />,
    );
    expect(screen.getByText('3 events · click to collapse')).toBeTruthy();
    fireEvent.click(screen.getByText('Diagrams Renamed'));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  // The host's menu on a stack (docs/specs/013-workspace/timeline.md §2.9). Opening it must not
  // expand the run: the click stops at the slot.
  it('renders the host menu slot without letting its click toggle the run', () => {
    const onToggle = vi.fn();
    const onContextMenu = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={onToggle}
        slots={{ menu: <button type="button">Menu</button>, onContextMenu }}
      />,
    );
    fireEvent.click(screen.getByText('Menu'));
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByText('Diagrams Renamed'));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows its faux layers only while collapsed', () => {
    const { container, rerender } = render(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={() => {}}
      />,
    );
    // The card itself plus two layers for a run of three.
    const layers = () =>
      container.querySelectorAll('[aria-hidden].pointer-events-none.absolute.inset-0');
    expect(layers().length).toBe(2);
    rerender(
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={{ viewerId: 'me' }}
        onToggle={() => {}}
        expanded
      />,
    );
    expect(layers().length).toBe(0);
  });
});
