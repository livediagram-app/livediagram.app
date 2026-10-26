// The header's filter field stays mounted across views: a write still waiting when the view changes (Back with a
// mouse button or a swipe, which leave the field focused) belongs to the page left, never the next one.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the filter field across views', () => {
  it('drops a write still waiting when the view changes, rather than writing it onto the new page', async () => {
    const index = createFakeIndex({});
    const onNavigate = vi.fn();
    const at = (view: ExplorerView) => (
      <Explorer
        app="liveplanner"
        client={index.client}
        view={view}
        onNavigate={onNavigate}
        itemHref={(item) => `/plan/${item.id}`}
        onCreate={() => {}}
        viewerId="user_me"
        heroHidden
      />
    );
    const { rerender } = render(at({ kind: 'all' }));
    const field = screen.getByRole('combobox', { name: 'Filter plans' });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'budget', selectionStart: 6 } });
    rerender(at({ kind: 'favourites' }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('still writes a waiting filter onto the page it was typed on', async () => {
    const index = createFakeIndex({});
    const onNavigate = vi.fn();
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={onNavigate}
        itemHref={(item) => `/plan/${item.id}`}
        onCreate={() => {}}
        viewerId="user_me"
        heroHidden
      />,
    );
    const field = screen.getByRole('combobox', { name: 'Filter plans' });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'budget', selectionStart: 6 } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'all', q: 'budget' }, expect.any(String), {
      replace: true,
    });
  });
});
