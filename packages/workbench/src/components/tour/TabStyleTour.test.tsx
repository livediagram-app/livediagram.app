// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Finish } from '@liveworkspace/element-model/finish';
import type { TourOutcome } from './useTourEngine';
import { tabStyleTourSteps, type TabStyleTourApi } from './tab-style-tour-steps';
import { createTabStyleTour } from './TabStyleTour';

// The engine is the tour shell's own (useTourEngine.test.tsx); here it only hands back what the binding passed it.
const engine = vi.hoisted(() => ({
  last: null as null | {
    steps: { id: string }[];
    onStepView: () => void;
    onFinish: (o: TourOutcome) => void;
  },
}));
vi.mock('./useTourEngine', () => ({
  useTourEngine: (args: NonNullable<typeof engine.last>) => {
    engine.last = args;
    return { active: false, start: () => {} };
  },
}));

function fakeApi(start: Finish): TabStyleTourApi & { worn: Finish } {
  const api = {
    worn: start,
    showHome: vi.fn(),
    showFinish: vi.fn(),
    finish: () => api.worn,
    setFinish: vi.fn((f: Finish) => {
      api.worn = f;
    }),
  };
  return api;
}

// docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me", bound per editor in its components/tour/TabStyleTour.tsx.
describe('createTabStyleTour', () => {
  it('sends Started and Ended, and closes on the theme article', () => {
    const track = vi.fn();
    const { useTabStyleTour, TabStyleShowMeButton, TabStyleTourStage } = createTabStyleTour({
      ShowMeButton: ({ onStart }) => (
        <button type="button" onClick={onStart}>
          Show Me
        </button>
      ),
      ShowMeStage: ({ article }) => <p>{article}</p>,
      track,
    });
    renderHook(() => useTabStyleTour(fakeApi('flexible')));
    expect(engine.last!.steps.map((s) => s.id)).toEqual(tabStyleTourSteps().map((s) => s.id));
    engine.last!.onStepView();
    engine.last!.onFinish('completed');
    engine.last!.onFinish('skipped');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'TabStyleTourCompleted');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'TabStyleTourSkipped');

    const tour = { active: false } as never;
    render(
      <>
        <TabStyleShowMeButton tour={tour} />
        <TabStyleTourStage tour={tour} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'TabStyleTour');
    expect(screen.getByText('changingTheme')).toBeTruthy();
  });
});

describe('tabStyleTourSteps', () => {
  const byId = (id: string) => tabStyleTourSteps().find((s) => s.id === id)!;

  it('brings the home forward for its steps, and the Finish panel for the finish', () => {
    const api = fakeApi('flexible');
    for (const id of ['looks', 'mashup', 'pages', 'fine-tune']) void byId(id).prepare!(api);
    expect(api.showHome).toHaveBeenCalledTimes(4);
    void byId('finish').prepare!(api);
    expect(api.showFinish).toHaveBeenCalledOnce();
    expect(byId('mashup').selector!(api)).toContain('Mashup');
    expect(byId('finish').selector!(api)).toContain('Finish');
    expect(byId('try-finish').selector!(api)).toContain('Finish');
  });

  it('wears another finish for its step and puts the person’s own back, once', () => {
    const step = byId('try-finish');
    const api = fakeApi('flexible');
    void step.prepare!(api);
    expect(api.worn).toBe('sketch');
    // A second prepare (the engine re-running the step) keeps the person's own finish remembered.
    void step.prepare!(api);
    expect(api.setFinish).toHaveBeenCalledOnce();
    step.cleanup!(api);
    expect(api.worn).toBe('flexible');
    // Cleaned up already: nothing to put back.
    step.cleanup!(api);
    expect(api.setFinish).toHaveBeenCalledTimes(2);

    const sketched = fakeApi('sketch');
    void step.prepare!(sketched);
    expect(sketched.worn).toBe('marker');
    step.cleanup!(sketched);
    expect(sketched.worn).toBe('sketch');
  });
});
