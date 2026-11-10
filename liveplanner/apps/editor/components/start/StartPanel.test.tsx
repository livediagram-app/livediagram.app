// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, hexToRgb, planPalette } from '@liveplanner/project';
import { PlanBoardPicker } from '@/components/plan/PlanBoardPicker';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
// The start's colours follow the app's Appearance (start spec "Look"), never the tab's surface.
const appearance = vi.hoisted(() => ({ value: 'light' as 'light' | 'dark' }));
vi.mock('@liveplanner/ui', async (actual) => ({
  ...(await actual<typeof import('@liveplanner/ui')>()),
  useAppearance: () => ({ appearance: appearance.value }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  appearance.value = 'light';
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

// docs/specs/007-editor/start-panel.md "Rail": the chosen group's count is the panel's ink on the accent's tint. The
// accent itself on that tint (its 22% over the row's 14%, over the card) read 3.6:1 in dark, under WCAG AA.
describe('the chosen rail count', () => {
  const over = (paper: string, colour: string, share: number) => {
    const [p, c] = [hexToRgb(paper)!, hexToRgb(colour)!];
    const mix = (a: number, b: number) =>
      Math.round(a * (1 - share) + b * share)
        .toString(16)
        .padStart(2, '0');
    return `#${mix(p.r, c.r)}${mix(p.g, c.g)}${mix(p.b, c.b)}`;
  };

  it.each(['dark', 'light'] as const)('reads at AA in %s', (mode) => {
    appearance.value = mode;
    render(<PlanBoardPicker onPick={vi.fn()} />);
    const palette = planPalette(mode, {});
    const chosen = document.querySelector<HTMLElement>('[data-rail][aria-current="true"]')!;
    const badge = chosen.lastElementChild as HTMLElement;
    const { r, g, b } = hexToRgb(palette.text)!;
    expect(badge.style.color).toBe(`rgb(${r}, ${g}, ${b})`);
    const pill = over(over(palette.card, palette.focus, 0.14), palette.focus, 0.22);
    expect(contrastRatio(palette.text, pill)).toBeGreaterThanOrEqual(4.5);
  });
});

// docs/specs/006-project/save-locations.md "On the start screen": the switch's strip shows only with the switch in it.
describe('the footer strip', () => {
  it('hides while the switch is not offered, leaving no empty strip', () => {
    startPlanning();
    const footer = document.querySelector('footer')!;
    expect(footer.childElementCount).toBe(0);
    expect(footer.className).toContain('empty:hidden');
  });
});

// docs/specs/007-editor/start-panel.md "Keyboard": on a fine pointer the search takes focus as the panel opens, but
// only from the page or the canvas. The panel's chunk loads when drawn, so it can arrive after a menu opened from the
// keyboard; it never takes focus from one.
describe('the search taking focus as the panel opens', () => {
  const pointer = (fine: boolean) => {
    // jsdom has no matchMedia: the panel asks it whether the pointer is fine.
    window.matchMedia = (query: string) =>
      ({ matches: fine && query === '(pointer: fine)' }) as MediaQueryList;
  };
  afterEach(() => {
    // @ts-expect-error jsdom has none to put back.
    delete window.matchMedia;
    document.body.replaceChildren();
  });

  it('takes it from the page', () => {
    pointer(true);
    const { search } = startPlanning();
    expect(document.activeElement).toBe(search);
  });

  it('takes it from the canvas the panel stands on', () => {
    pointer(true);
    const canvas = document.createElement('main');
    canvas.setAttribute('data-canvas-root', '');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();
    const { search } = startPlanning();
    expect(document.activeElement).toBe(search);
  });

  it('leaves it with a control reached before the panel arrived', () => {
    pointer(true);
    const menuControl = document.createElement('button');
    document.body.append(menuControl);
    menuControl.focus();
    startPlanning();
    expect(document.activeElement).toBe(menuControl);
  });

  it('leaves the page alone on a coarse pointer', () => {
    pointer(false);
    startPlanning();
    expect(document.activeElement).toBe(document.body);
  });
});

// docs/specs/007-editor/start-panel.md "The header band": the header wears the app's own Explorer hero backdrop, in the panel's colours.
describe('the start header band', () => {
  it("draws the app's own band and title mark behind the header, hidden from screen readers", () => {
    startPlanning();
    const band = document.querySelector('header [data-start-band]');
    expect(band?.getAttribute('data-start-band')).toBe('lanes');
    expect(band?.getAttribute('aria-hidden')).toBe('true');
    const mark = document.querySelector('header [data-start-title-mark]');
    expect(mark?.getAttribute('data-start-title-mark')).toBe('lanes');
    // The title in the hero's face: serif for the Typesetter alone.
    const title = document.querySelector('header h2')!;
    expect(title.className.includes('font-serif')).toBe(false);
  });
});
