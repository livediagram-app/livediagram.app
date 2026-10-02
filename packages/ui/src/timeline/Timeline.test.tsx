// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Timeline } from './Timeline';
import { useTimelineControls } from './useTimelineControls';
import type { TimelineEvent } from './types';

const ME = 'me';

function event(id: string): TimelineEvent {
  return {
    id,
    sourceType: 'document',
    sourceId: id,
    eventType: 'document_created',
    title: 'Document Created',
    description: null,
    occurredAt: 1_700_000_000_000,
    actorId: ME,
    snapshot: { documentId: id, documentName: id },
  } as TimelineEvent;
}

/** Controls whose only loaded events are the viewer's own, filtered to "Other people". */
function filteredToNothing() {
  const { result } = renderHook(() =>
    useTimelineControls([event('a'), event('b')], { viewerId: ME }),
  );
  act(() => result.current.setActorFilter('others'));
  expect(result.current.visibleEvents).toHaveLength(0);
  return result.current;
}

// Filtered-empty stays honest and distinct (docs/specs/013-workspace/timeline.md §2.3, §2.4).
describe('Timeline filtered-empty state', () => {
  it('keeps Show more when the loaded events match nothing but more pages exist', () => {
    const controls = filteredToNothing();
    const onLoadMore = vi.fn();

    render(<Timeline controls={controls} viewerId={ME} hasMore onLoadMore={onLoadMore} />);

    expect(screen.getByText('No matches in the events loaded so far.')).toBeTruthy();
    expect(screen.queryByText('No events match these filters.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('disables Show more while the next page is loading', () => {
    const controls = filteredToNothing();

    render(<Timeline controls={controls} viewerId={ME} hasMore loadingMore onLoadMore={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Loading…' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('says nothing matches when every page is loaded', () => {
    const controls = filteredToNothing();

    render(<Timeline controls={controls} viewerId={ME} hasMore={false} onLoadMore={vi.fn()} />);

    expect(screen.getByText('No events match these filters.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});
