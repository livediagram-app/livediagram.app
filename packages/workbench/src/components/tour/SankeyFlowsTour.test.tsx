// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TourOutcome } from './useTourEngine';
import { createSankeyFlowsTour } from './SankeyFlowsTour';

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

const api = { setTab: () => {} } as never;

function bind() {
  const track = vi.fn();
  const parts = createSankeyFlowsTour({
    ShowMeButton: ({ onStart }) => (
      <button type="button" onClick={onStart}>
        Show Me
      </button>
    ),
    ShowMeStage: ({ article }) => <p>{article}</p>,
    track,
  });
  return { track, ...parts };
}

// docs/specs/009-elements/sankey.md "Show Me", bound per editor in its components/tour/SankeyFlowsTour.tsx.
describe('createSankeyFlowsTour', () => {
  it('sends Started before the editor starts the tour, and closes on the Sankey article', () => {
    const { track, SankeyFlowsShowMeButton, SankeyFlowsTourStage } = bind();
    const onStart = vi.fn(() =>
      expect(track).toHaveBeenCalledWith('UI', 'Started', 'SankeyFlowsTour'),
    );
    const tour = { active: false } as never;
    render(
      <>
        <SankeyFlowsShowMeButton tour={tour} onStart={onStart} />
        <SankeyFlowsTourStage tour={tour} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.getByText('sankeyDiagram')).toBeTruthy();
  });

  it('reports how it ended, and freezes its steps from the dialog as it is at the press', () => {
    const { track, useSankeyFlowsTour } = bind();
    const { result, rerender } = renderHook(
      (context: { hasNodes: boolean; hasBalanceNotes: boolean }) =>
        useSankeyFlowsTour(context, api),
      { initialProps: { hasNodes: false, hasBalanceNotes: false } },
    );
    const before = engine.last!.steps.map((s) => s.id);
    rerender({ hasNodes: true, hasBalanceNotes: true });
    // Not frozen yet: the steps are still the ones from the first render.
    expect(engine.last!.steps.map((s) => s.id)).toEqual(before);
    act(() => result.current.freeze());
    expect(engine.last!.steps.map((s) => s.id)).toContain('balance');
    engine.last!.onStepView();
    engine.last!.onFinish('completed');
    engine.last!.onFinish('skipped');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyFlowsTourCompleted');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyFlowsTourSkipped');
  });
});
