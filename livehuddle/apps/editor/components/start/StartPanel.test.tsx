// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function workshop() {
  const onTemplate = vi.fn();
  render(<StartFromTemplates mode="workshop" tabId="t1" onTemplate={onTemplate} />);
  const search = screen.getByRole('textbox', { name: 'Find a template' });
  return { onTemplate, search };
}

// docs/specs/007-editor/start-diagramming.md "A title match leads" and "Keyboard": a template named as typed leads the
// results, under Best Match, and the arrow keys move between the cards.
describe('a start search, best match first', () => {
  const sections = () =>
    [...document.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'));

  it('leads with the template whose name is what was typed, and lists it once', () => {
    const { search } = workshop();
    fireEvent.change(search, { target: { value: 'team pod' } });
    const best = screen.getByRole('region', { name: 'Best Match' });
    const first = best.querySelector('[data-start-card]')!.getAttribute('data-start-card');
    expect(first).toBe('team-pod');
    expect(document.querySelectorAll('[data-start-card="team-pod"]')).toHaveLength(1);
    // Before the groups.
    expect(sections()[0]).toBe('Best Match');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-start-card')).toBe('team-pod');
  });

  it('has no Best Match when no name begins with the words', () => {
    const { search } = workshop();
    fireEvent.change(search, { target: { value: 'coffee' } });
    expect(screen.queryByRole('region', { name: 'Best Match' })).toBeNull();
  });

  it('moves between the cards with the arrow keys, Up from the first back to the search', () => {
    const { search } = workshop();
    fireEvent.change(search, { target: { value: 'office' } });
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
    workshop();
    const panel = screen.getByRole('textbox', { name: 'Find a template' }).closest('section')!;
    const wrapper = panel.parentElement!;
    expect(wrapper.className).toContain('short-window:pt-16');
    // Over the bottom cluster, but on the tab bar while it shows (the measured floor).
    expect(wrapper.className).toContain('short-window:pb-[var(--start-floor)]');
    expect(wrapper.className).toContain('short-window:z-[var(--z-overlay)]');
    expect(wrapper.className).not.toContain('landscape-phone:');
  });
});

// docs/specs/007-editor/start-diagramming.md "The header band": the header wears the app's own Explorer hero backdrop, in the panel's colours.
describe('the start header band', () => {
  it("draws the app's own band and title mark behind the header, hidden from screen readers", () => {
    workshop();
    const band = document.querySelector('header [data-start-band]');
    expect(band?.getAttribute('data-start-band')).toBe('huddle');
    expect(band?.getAttribute('aria-hidden')).toBe('true');
    const mark = document.querySelector('header [data-start-title-mark]');
    expect(mark?.getAttribute('data-start-title-mark')).toBe('huddle');
    // The title in the hero's face: serif for the Typesetter alone.
    const title = document.querySelector('header h2')!;
    expect(title.className.includes('font-serif')).toBe(false);
  });
});
