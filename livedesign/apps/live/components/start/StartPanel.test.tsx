// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, hexToRgb, type CanvasSurface } from '@livedesign/design';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { startPalette } from './start-palette';
import { StartFromTemplates } from './StartFromTemplates';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function pages() {
  const onTemplate = vi.fn();
  render(<StartFromTemplates mode="pages" tabId="t1" onTemplate={onTemplate} />);
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
    fireEvent.change(search, { target: { value: 'logo' } });
    const best = screen.getByRole('region', { name: 'Best Match' });
    const first = best.querySelector('[data-start-card]')!.getAttribute('data-start-card');
    expect(first).toBe('logo-design');
    expect(document.querySelectorAll('[data-start-card="logo-design"]')).toHaveLength(1);
    // Before the groups, Logos' Blank Logo among them.
    expect(sections().indexOf('Best Match')).toBeLessThan(sections().indexOf('Logos'));
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-start-card')).toBe('logo-design');
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

// docs/specs/007-editor/start-diagramming.md "Rail": the chosen group's count is the panel's ink on the accent's tint.
// The accent itself on that tint (its 22% over the row's 14%, over the card) read under WCAG AA.
describe('the chosen rail count', () => {
  const over = (paper: string, colour: string, share: number) => {
    const [p, c] = [hexToRgb(paper)!, hexToRgb(colour)!];
    const mix = (a: number, b: number) =>
      Math.round(a * (1 - share) + b * share)
        .toString(16)
        .padStart(2, '0');
    return `#${mix(p.r, c.r)}${mix(p.g, c.g)}${mix(p.b, c.b)}`;
  };

  it.each<CanvasSurface>(['dark', 'light'])('reads at AA in %s', (surface) => {
    render(
      <CanvasSurfaceProvider surface={surface}>
        <StartFromTemplates mode="pages" tabId="t1" onTemplate={vi.fn()} />
      </CanvasSurfaceProvider>,
    );
    const palette = startPalette(surface, {});
    const chosen = document.querySelector<HTMLElement>('[data-rail][aria-current="true"]')!;
    const badge = chosen.lastElementChild as HTMLElement;
    const { r, g, b } = hexToRgb(palette.text)!;
    expect(badge.style.color).toBe(`rgb(${r}, ${g}, ${b})`);
    const pill = over(over(palette.card, palette.focus, 0.14), palette.focus, 0.22);
    expect(contrastRatio(palette.text, pill)).toBeGreaterThanOrEqual(4.5);
    // The accent it replaced, for the record: under AA on the same pill.
    expect(contrastRatio(palette.focus, pill)).toBeLessThan(4.5);
  });
});
