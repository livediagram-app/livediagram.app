// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompactEmptyState, NoMatches, noMatchHint, noMatchTitle } from './CompactEmptyState';

// How much of the words a heading quotes (NO_MATCH_QUERY_MAX in CompactEmptyState.tsx).
const QUOTE_MAX = 40;
const quoted = (q: string) => noMatchTitle('cards', q).replace(/^No cards match /, '');

// docs/specs/004-interface-design/empty-states.md
describe('noMatchTitle', () => {
  it('quotes the words a search found nothing for', () => {
    expect(noMatchTitle('cards', '  launch ')).toBe('No cards match “launch”');
  });

  it('names the filters when only filters narrowed it', () => {
    expect(noMatchTitle('cards', '', 2)).toBe('No cards match these filters');
  });

  it('quotes the words when words and filters found nothing together', () => {
    expect(noMatchTitle('cards', 'x', 1)).toBe('No cards match “x”');
  });

  it('still starts "No <things>" with neither', () => {
    expect(noMatchTitle('icons')).toBe('No icons match');
  });
});

describe('the quoted words', () => {
  it('collapses runs of space', () => {
    expect(quoted('a   b')).toBe('“a b”');
  });

  it('cuts long words to the cap with an ellipsis', () => {
    const q = quoted('x'.repeat(200));
    expect(q.length).toBe(QUOTE_MAX + 2);
    expect(q.endsWith('…”')).toBe(true);
  });

  it('keeps words at the cap whole', () => {
    expect(quoted('y'.repeat(QUOTE_MAX))).toBe(`“${'y'.repeat(QUOTE_MAX)}”`);
  });
});

describe('noMatchHint', () => {
  it('says what to try for each cause', () => {
    expect(noMatchHint('a')).toBe('Try another word.');
    expect(noMatchHint('a', 1)).toBe('Try another word or remove a filter.');
    expect(noMatchHint('', 1)).toBe('Remove a filter to see more.');
  });
});

describe('CompactEmptyState', () => {
  it('draws the badge, the heading, the line and the action', () => {
    render(
      <CompactEmptyState
        icon={<svg data-testid="glyph" />}
        title="No states yet"
        description="Add one to a board."
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByTestId('glyph').parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('No states yet')).toBeTruthy();
    expect(screen.getByText('Add one to a board.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('leaves the line and the action out when not given', () => {
    const { container } = render(<CompactEmptyState icon={null} title="Empty Slot" />);
    expect(container.querySelectorAll('span').length).toBe(2);
  });

  it('draws the small size for a popover', () => {
    const { container } = render(<CompactEmptyState size="small" icon={null} title="No icons" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.dataset.emptyState).toBe('small');
    expect(box.querySelector('span')!.className).toContain('h-7');
  });

  it('defaults to the regular size', () => {
    const { container } = render(<CompactEmptyState icon={null} title="No icons" />);
    expect((container.firstElementChild as HTMLElement).dataset.emptyState).toBe('regular');
  });
});

describe('CompactEmptyState on a themed surface', () => {
  it('paints the heading and the line in the surface ink', () => {
    render(
      <CompactEmptyState
        icon={null}
        title="No cards"
        description="Line"
        ink={{ text: 'rgb(1, 2, 3)', muted: 'rgb(4, 5, 6)' }}
      />,
    );
    expect(screen.getByText('No cards').style.color).toBe('rgb(1, 2, 3)');
    expect(screen.getByText('Line').style.color).toBe('rgb(4, 5, 6)');
  });
});

describe('NoMatches', () => {
  it('is a polite status with the heading and the default line', () => {
    render(<NoMatches things="cards" query="launch" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('No cards match “launch”');
    expect(status.textContent).toContain('Try another word.');
  });

  it('offers Clear Search for words and clears on press', () => {
    const onClear = vi.fn();
    render(<NoMatches things="cards" query="x" filters={2} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('offers Clear Filters when only filters narrowed it', () => {
    render(<NoMatches things="cards" filters={1} onClear={() => {}} />);
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeTruthy();
    expect(screen.getByText('No cards match these filters')).toBeTruthy();
  });

  it('takes the surface its own line, or none', () => {
    const { rerender } = render(
      <NoMatches things="images" query="cat" hint="Try a broader word." />,
    );
    expect(screen.getByText('Try a broader word.')).toBeTruthy();
    rerender(<NoMatches things="images" query="cat" hint={null} />);
    expect(screen.queryByText('Try another word.')).toBeNull();
  });

  it('has no button without a clear', () => {
    render(<NoMatches things="cards" query="x" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// docs/specs/004-interface-design/empty-states.md "Announced": the live region is in the page before its words.
describe('an empty state that is announced', () => {
  it('speaks through a region that mounts empty and takes its words after', () => {
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });
    render(<NoMatches things="cards" query="zzz" />);
    const records = observer.takeRecords();
    observer.disconnect();
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('No cards match “zzz”. Try another word.');
    // The words went into the region once it was in the page (a change to the region itself, which a screen reader
    // announces), not in with it.
    expect(records.some((r) => r.target === region && r.addedNodes.length > 0)).toBe(true);
    // Read once: the words on show are hidden from a screen reader.
    expect(screen.getByText('No cards match “zzz”').getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps a quiet empty state out of the live region', () => {
    render(<CompactEmptyState icon={null} title="No states yet" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('a no-match clear', () => {
  it('names what it takes: the search, the filters, or both when it takes both', () => {
    const label = (query: string, filters: number, clearsBoth?: boolean) => {
      const { unmount } = render(
        <NoMatches
          things="cards"
          query={query}
          filters={filters}
          onClear={() => {}}
          clearsBoth={clearsBoth}
        />,
      );
      const text = screen.getByRole('button').textContent;
      unmount();
      return text;
    };
    expect(label('x', 0)).toBe('Clear Search');
    expect(label('', 2)).toBe('Clear Filters');
    expect(label('x', 2)).toBe('Clear Search');
    expect(label('x', 2, true)).toBe('Clear Search and Filters');
    expect(label('x', 0, true)).toBe('Clear Search');
    expect(label('', 1, true)).toBe('Clear Filters');
  });
});
