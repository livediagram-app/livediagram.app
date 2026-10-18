// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { PlanBoardPicker } from '@/components/plan/PlanBoardPicker';
import { StartFromTemplates } from './StartFromTemplates';
import { OTHER_MODE_CARDS_MAX } from './other-mode-matches';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));

// docs/specs/007-editor/start-diagramming.md "Found in other modes": a start's search also finds every other mode's
// templates, under In Other Modes, and choosing one switches the tab to that mode.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const switchable = (mode: 'diagram' | 'plan', canSwitch = true) =>
  ({ mode, setMode: vi.fn(), canEdit: true, canSwitch, crossPlan: canSwitch }) as never;

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
    const plan = within(otherModes()).getByRole('region', { name: 'Plan' });
    const cards = () => plan.querySelectorAll('[data-start-card]').length;
    expect(cards()).toBe(OTHER_MODE_CARDS_MAX);
    const showAll = within(plan).getByRole('button', { name: /^Show All \d+$/ });
    const total = Number(showAll.textContent.replace('Show All ', ''));
    fireEvent.click(showAll);
    expect(cards()).toBe(total);
    expect(within(plan).queryByRole('button', { name: /^Show All/ })).toBeNull();
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

  it('reaches the other modes from Start Planning too', () => {
    const onOtherModeTemplate = vi.fn();
    render(
      <EditorModeProvider value={switchable('plan')}>
        <PlanBoardPicker onPick={vi.fn()} onOtherModeTemplate={onOtherModeTemplate} />
      </EditorModeProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a board, sheet, form or layout' }), {
      target: { value: 'sailboat' },
    });
    fireEvent.click(within(otherModes()).getByRole('button', { name: /^Sailboat.* in Workshop:/ }));
    expect(onOtherModeTemplate).toHaveBeenCalledWith('workshop', 'sailboat');
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

  it('leads Start Planning with a title match too', () => {
    render(
      <EditorModeProvider value={switchable('plan')}>
        <PlanBoardPicker onPick={vi.fn()} />
      </EditorModeProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a board, sheet, form or layout' }), {
      target: { value: 'kanban' },
    });
    const best = screen.getByRole('region', { name: 'Best Match' });
    expect(within(best).getAllByRole('button')[0]!.getAttribute('aria-label')).toMatch(/^Kanban/);
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
