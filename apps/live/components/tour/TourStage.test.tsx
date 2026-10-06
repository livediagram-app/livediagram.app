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
    render(<TourStage engine={e} layoutPicker={<p>picker</p>} />);
    expect(screen.getByText('Quick tour')).toBeTruthy();
    expect(screen.getByText('picker')).toBeTruthy();
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
});
