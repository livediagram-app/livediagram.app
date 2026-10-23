// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function pages() {
  const onTemplate = vi.fn();
  render(<StartFromTemplates tabId="t1" onTemplate={onTemplate} />);
  const search = screen.getByRole('textbox', { name: 'Find a template' });
  return { onTemplate, search };
}

// docs/specs/007-editor/start-diagramming.md "The panel": a search with no match shows the shared empty state.
describe('a start search with no match', () => {
  it('shows the empty state', () => {
    const { search } = pages();
    fireEvent.change(search, { target: { value: 'zzzz-nothing' } });
    expect(screen.getByText('No page templates match “zzzz-nothing”')).toBeTruthy();
    expect(screen.getByText('Try another word.')).toBeTruthy();
  });
});

// docs/specs/007-editor/start-diagramming.md "A title match leads" and "Keyboard": a template named as typed leads the
// results, under Best Match, and the arrow keys move between the cards.
describe('a start search, best match first', () => {
  const sections = () =>
    [...document.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'));

  it('leads with the template whose name is what was typed, and lists it once', () => {
    const { search } = pages();
    fireEvent.change(search, { target: { value: 'slide deck' } });
    const best = screen.getByRole('region', { name: 'Best Match' });
    const first = best.querySelector('[data-start-card]')!.getAttribute('data-start-card');
    expect(first).toBe('slide-deck');
    expect(document.querySelectorAll('[data-start-card="slide-deck"]')).toHaveLength(1);
    // Before the groups, Slides' Blank Slide Deck among them.
    expect(sections().indexOf('Best Match')).toBeLessThan(sections().indexOf('Slides'));
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-start-card')).toBe('slide-deck');
  });

  it('has no Best Match when no name begins with the words', () => {
    const { search } = pages();
    fireEvent.change(search, { target: { value: 'wireframe' } });
    expect(screen.queryByRole('region', { name: 'Best Match' })).toBeNull();
  });

  it('moves between the cards with the arrow keys, Up from the first back to the search', () => {
    const { search } = pages();
    fireEvent.change(search, { target: { value: 'wireframe' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    const all = [...document.querySelectorAll<HTMLElement>('[data-start-card]')];
    expect(all.length).toBeGreaterThan(2);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(all[0]);
    // jsdom lays nothing out: every card is in one row, so Up leaves the cards for the search.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search);
  });
});

// docs/specs/007-editor/start-diagramming.md "On a short window": a window under 500px tall (a phone held sideways, a
// desktop zoomed to 200%) keeps the cards room. jsdom does no layout, so this holds the classes.
describe('the start panel on a short window', () => {
  it('clears only the strip and lies over the bottom cluster, whatever the pointer', () => {
    pages();
    const panel = screen.getByRole('textbox', { name: 'Find a template' }).closest('section')!;
    const wrapper = panel.parentElement!;
    expect(wrapper.className).toContain('short-window:pt-16');
    // Over the bottom cluster, but on the tab bar while it shows (the measured floor).
    expect(wrapper.className).toContain('short-window:pb-[var(--start-floor)]');
    expect(wrapper.className).toContain('short-window:z-[var(--z-overlay)]');
    expect(wrapper.className).not.toContain('landscape-phone:');
  });
});
