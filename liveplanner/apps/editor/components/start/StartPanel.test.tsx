// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanBoardPicker } from '@/components/plan/PlanBoardPicker';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function startPlanning() {
  render(<PlanBoardPicker onPick={vi.fn()} />);
  const search = screen.getByRole('textbox', { name: 'Find a board, sheet, form or layout' });
  return { search };
}

// docs/specs/007-editor/start-panel.md "A title match leads" and "Keyboard": a template named as typed leads the
// results, under Best Match, and the arrow keys move between the cards.
describe('a start search, best match first', () => {
  it('leads Start Planning with a title match', () => {
    const { search } = startPlanning();
    fireEvent.change(search, { target: { value: 'kanban' } });
    const best = screen.getByRole('region', { name: 'Best Match' });
    expect(within(best).getAllByRole('button')[0]!.getAttribute('aria-label')).toMatch(/^Kanban/);
  });

  it('moves from the search to the first card found with Down, and Up from the first back to the search', () => {
    const { search } = startPlanning();
    fireEvent.change(search, { target: { value: 'kanban' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    const all = [...document.querySelectorAll<HTMLElement>('[data-start-card]')];
    expect(all.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(all[0]);
    // jsdom lays nothing out: every card is in one row, so Up leaves the cards for the search.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search);
  });
});

// docs/specs/007-editor/start-panel.md "On a short window": a window under 500px tall (a phone held sideways, a
// desktop zoomed to 200%) keeps the cards room. jsdom does no layout, so this holds the classes.
describe('the start panel on a short window', () => {
  it('clears only the strip and lies over the bottom cluster, whatever the pointer', () => {
    const { search } = startPlanning();
    const panel = search.closest('section')!;
    const wrapper = panel.parentElement!;
    expect(wrapper.className).toContain('short-window:pt-16');
    // Over the bottom cluster, but on the tab bar while it shows (the measured floor).
    expect(wrapper.className).toContain('short-window:pb-[var(--start-floor)]');
    expect(wrapper.className).toContain('short-window:z-[var(--z-overlay)]');
    expect(wrapper.className).not.toContain('landscape-phone:');
  });
});
