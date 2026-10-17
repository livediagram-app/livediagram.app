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
    const facilitate = within(otherModes()).getByRole('region', { name: 'Facilitate' });
    const sailboat = within(facilitate).getByRole('button', { name: /^Sailboat.* in Facilitate:/ });
    expect(within(sailboat).getByText('Opens in Facilitate')).toBeTruthy();
    fireEvent.click(sailboat);
    expect(onOtherModeTemplate).toHaveBeenCalledWith('facilitate', 'sailboat');
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
    fireEvent.click(
      within(otherModes()).getByRole('button', { name: /^Sailboat.* in Facilitate:/ }),
    );
    expect(onOtherModeTemplate).toHaveBeenCalledWith('facilitate', 'sailboat');
  });
});

// docs/specs/007-editor/live-app.md "A phone held sideways": the panel keeps its desktop clearances everywhere but a
// phone held sideways, where they left its list 56px tall. jsdom does no layout, so this holds the classes.
describe('the start panel on a phone held sideways', () => {
  it('clears only the strip and lies over the bottom cluster', () => {
    diagram();
    const panel = screen.getByRole('textbox', { name: 'Find a template' }).closest('section')!;
    const wrapper = panel.parentElement!;
    expect(wrapper.className).toContain('landscape-phone:pt-16');
    expect(wrapper.className).toContain('landscape-phone:pb-2');
    expect(wrapper.className).toContain('landscape-phone:z-[var(--z-overlay)]');
  });
});
