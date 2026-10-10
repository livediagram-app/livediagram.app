// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from './tour-step';
import type { TourEngine } from './useTourEngine';
import { TourStage } from './TourStage';
import { PlanTourArt } from './PlanTourArt';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), with a second tour's own
// card words (docs/specs/026-plan/plan-tour.md).

afterEach(cleanup);

function engine(step: TourStepOf<unknown>, over: Partial<TourEngine<unknown>> = {}) {
  return {
    active: true,
    step,
    stepIndex: step.card === 'outro' ? 3 : step.card ? 0 : 2,
    stepDir: 'forward',
    targetRect: null,
    countableSteps: 2,
    hasWelcome: true,
    start: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    ...over,
  } as TourEngine<unknown>;
}

describe('TourStage', () => {
  it('draws nothing while the tour is not running', () => {
    const { container } = render(
      <TourStage engine={engine({ id: 'a', title: 'A', body: '' }, { active: false })} />,
    );
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('[data-tour-popover]')).toBeNull();
  });

  it("wears the welcome tour's words by default", () => {
    const e = engine({ id: 'welcome', card: 'welcome', title: 'Welcome', body: 'Hi' });
    render(<TourStage engine={e} />);
    expect(screen.getByText('Quick tour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show me around' }));
    expect(e.next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(e.skip).toHaveBeenCalled();
  });

  it("wears a second tour's own words and art", () => {
    const welcome = engine({ id: 'welcome', card: 'welcome', title: 'Welcome to Plan', body: '' });
    const { unmount } = render(
      <TourStage
        engine={welcome}
        copy={{ welcomeEyebrow: 'Plan tour', finish: 'Start planning', helpHref: '/help/x/' }}
        welcomeArt={<PlanTourArt />}
      />,
    );
    expect(screen.getByText('Plan tour')).toBeTruthy();
    unmount();
    render(
      <TourStage
        engine={engine({ id: 'outro', card: 'outro', title: 'Done', body: '' })}
        copy={{ finish: 'Start planning', helpHref: '/help/x/' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Start planning' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Visit Help Centre' }).getAttribute('href')).toBe(
      '/help/x/',
    );
  });

  it('offers each way in on a welcome card with choices, in place of the accept', () => {
    const e = engine({ id: 'welcome', card: 'welcome', title: 'Welcome to Plan', body: '' });
    const boards = vi.fn();
    const sheets = vi.fn();
    render(
      <TourStage
        engine={e}
        welcomeChoices={[
          { id: 'boards', label: 'Boards', onPick: boards },
          { id: 'sheets', label: 'Spreadsheets', onPick: sheets },
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Show me around' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spreadsheets' }));
    expect(sheets).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Boards' }));
    expect(boards).toHaveBeenCalled();
    expect(e.next).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(e.skip).toHaveBeenCalled();
  });

  it('rings the target and labels the step with the tour', () => {
    const e = engine(
      { id: 'one', title: 'One', body: 'Copy' },
      { targetRect: { left: 10, top: 10, width: 50, height: 20 } },
    );
    render(<TourStage engine={e} ariaPrefix="Plan tour" />);
    expect(screen.getByRole('dialog', { name: 'Plan tour step 2 of 2: One' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(e.back).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(e.skip).toHaveBeenCalled();
  });

  // Show Me (the card type editor) has no welcome card: its first step is "1 of N", with no Back.
  it('counts a tour without a welcome card from its first step, ringed over a dialog', () => {
    const e = engine(
      { id: 'general', title: 'General', body: 'Copy' },
      {
        stepIndex: 0,
        countableSteps: 5,
        hasWelcome: false,
        targetRect: { left: 20, top: 20, width: 100, height: 40 },
      },
    );
    render(<TourStage engine={e} ariaPrefix="Show Me" layer="modal" pad={14} />);
    expect(screen.getByRole('dialog', { name: 'Show Me step 1 of 5: General' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    const ring = document.querySelector<HTMLElement>('.border-brand-400');
    expect(ring?.className).toContain('z-[calc(var(--z-modal)+1)]');
    expect(ring?.style.left).toBe('6px');
    expect(ring?.style.width).toBe('128px');
  });
});
