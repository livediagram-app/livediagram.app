// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import {
  contrastRatio,
  editorModeLabel,
  hexToRgb,
  type CanvasSurface,
} from '@livediagram/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { startPalette } from './start-palette';
import { StartFromTemplates } from './StartFromTemplates';
import { OTHER_MODE_CARDS_MAX } from './other-mode-matches';

// docs/specs/007-editor/start-diagramming.md "Found in other modes": a start's search also finds every other mode's
// templates, under In Other Modes, and choosing one switches the tab to that mode.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const switchable = (mode: 'diagram', canSwitch = true) =>
  ({ mode, setMode: vi.fn(), canEdit: true, canSwitch }) as never;

function diagram(canSwitch = true) {
  const onTemplate = vi.fn();
  const onOtherModeTemplate = vi.fn();
  render(
    <EditorModeProvider value={switchable('diagram', canSwitch)}>
      <StartFromTemplates
        mode="diagram"
        tabId="t1"
        onTemplate={onTemplate}
        onOtherModeTemplate={onOtherModeTemplate}
      />
    </EditorModeProvider>,
  );
  const search = screen.getByRole('textbox', { name: 'Find a template' });
  return { onTemplate, onOtherModeTemplate, search };
}

const otherModes = () => screen.getByRole('region', { name: 'In Other Modes' });

describe('a start search, in other modes', () => {
  it("shows another mode's matches after the mode's own, and lands one in its mode", () => {
    const { onTemplate, onOtherModeTemplate, search } = diagram();
    fireEvent.change(search, { target: { value: 'retro' } });
    const workshop = within(otherModes()).getByRole('region', { name: 'Workshop' });
    const sailboat = within(workshop).getByRole('button', { name: /^Sailboat.* in Workshop:/ });
    expect(within(sailboat).getByText('Opens in Workshop')).toBeTruthy();
    fireEvent.click(sailboat);
    expect(onOtherModeTemplate).toHaveBeenCalledWith('workshop', 'sailboat');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('says the mode found nothing in one line, then shows what the others found', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'sailboat' } });
    expect(screen.getByRole('status').textContent).toBe(
      'No diagram templates match “sailboat”. Found in other modes.',
    );
    expect(otherModes()).toBeTruthy();
  });

  it('shows the empty state only when no mode has a match', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'zzzz-nothing' } });
    expect(screen.getByText('No diagram templates match “zzzz-nothing”')).toBeTruthy();
    expect(screen.getByText('Try another word.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'In Other Modes' })).toBeNull();
  });

  it(`shows at most ${OTHER_MODE_CARDS_MAX} a mode, then Show All`, () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'e' } });
    const other = within(otherModes()).getByRole('region', { name: editorModeLabel('workshop') });
    const cards = () => other.querySelectorAll('[data-start-card]').length;
    expect(cards()).toBe(OTHER_MODE_CARDS_MAX);
    const showAll = within(other).getByRole('button', { name: /^Show All \d+$/ });
    const total = Number(showAll.textContent.replace('Show All ', ''));
    fireEvent.click(showAll);
    expect(cards()).toBe(total);
    expect(within(other).queryByRole('button', { name: /^Show All/ })).toBeNull();
  });

  it('keeps to its own mode where the mode may not change', () => {
    const { search } = diagram(false);
    fireEvent.change(search, { target: { value: 'sailboat' } });
    expect(screen.queryByRole('region', { name: 'In Other Modes' })).toBeNull();
    expect(screen.getByText('Try another word.')).toBeTruthy();
  });

  it('moves from the search to the first card found with Down', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'sailboat' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-start-card')).toBe('sailboat');
  });
});

// docs/specs/007-editor/start-diagramming.md "A title match leads" and "Keyboard": a template named as typed leads the
// results, under Best Match, and the arrow keys move between the cards.
describe('a start search, best match first', () => {
  const sections = () =>
    [...document.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'));

  it('leads with the template whose name is what was typed, and lists it once', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'flowchart' } });
    const best = screen.getByRole('region', { name: 'Best Match' });
    const first = best.querySelector('[data-start-card]')!.getAttribute('data-start-card');
    expect(first).toBe('flowchart');
    expect(document.querySelectorAll('[data-start-card="flowchart"]')).toHaveLength(1);
    // Before the groups, Design's Service Blueprint among them.
    expect(sections().indexOf('Best Match')).toBeLessThan(sections().indexOf('Design'));
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-start-card')).toBe('flowchart');
  });

  it('has no Best Match when no name begins with the words', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'blueprint' } });
    expect(screen.queryByRole('region', { name: 'Best Match' })).toBeNull();
  });

  it('moves between the cards with the arrow keys, Up from the first back to the search', () => {
    const { search } = diagram();
    fireEvent.change(search, { target: { value: 'flow' } });
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
    diagram();
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
// The accent itself on that tint (its 22% over the row's 14%, over the card) read 4.2:1 in dark and 2.7:1 in light,
// under WCAG AA.
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
        <EditorModeProvider value={switchable('diagram')}>
          <StartFromTemplates
            mode="diagram"
            tabId="t1"
            onTemplate={vi.fn()}
            onOtherModeTemplate={vi.fn()}
          />
        </EditorModeProvider>
      </CanvasSurfaceProvider>,
    );
    const palette = startPalette(surface, {});
    const chosen = document.querySelector<HTMLElement>('[data-rail][aria-current="true"]')!;
    const badge = chosen.lastElementChild as HTMLElement;
    const { r, g, b } = hexToRgb(palette.text)!;
    expect(badge.style.color).toBe(`rgb(${r}, ${g}, ${b})`);
    const pill = over(over(palette.card, palette.focus, 0.14), palette.focus, 0.22);
    expect(contrastRatio(palette.text, pill)).toBeGreaterThanOrEqual(4.5);
  });
});
