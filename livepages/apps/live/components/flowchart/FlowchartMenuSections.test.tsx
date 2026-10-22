// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FlowchartMenuSections } from './FlowchartMenuSections';

// docs/specs/009-elements/flowchart.md "The Flowchart menu": a Flowchart flyout row holding Chart, Step Type
// and Direction, each a closed category around a list of full-width rows.

// The flyout panel tracks its own size, which jsdom cannot.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function renderMenu(
  over: Partial<Parameters<typeof FlowchartMenuSections>[0]> = {},
  // Every category open by default, so a case can reach its rows; the first case closes them.
  open = true,
) {
  const props = {
    sectionProps: () => ({ open, onToggle: vi.fn() }),
    flyoutProps: {},
    stepType: 'process' as const,
    direction: 'down' as const,
    onSetStepType: vi.fn(),
    onSetDirection: vi.fn(),
    onAddLane: vi.fn(),
    onTidy: vi.fn(),
    ...over,
  };
  render(<FlowchartMenuSections {...props} />);
  // The Flowchart row opens its flyout of categories.
  fireEvent.click(screen.getByRole('button', { name: /Flowchart/ }));
  return props;
}

const expanded = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-expanded');

describe('FlowchartMenuSections', () => {
  it('opens a flyout of three closed categories', () => {
    renderMenu({}, false);
    for (const title of ['Chart', 'Step Type', 'Direction']) expect(expanded(title)).toBe('false');
  });

  it('opens each category on its own', () => {
    const sectionProps = vi.fn((id: string) => ({
      open: id === 'flowchart-direction',
      onToggle: vi.fn(),
    }));
    renderMenu({ sectionProps });
    expect(sectionProps.mock.calls.map(([id]) => id)).toEqual(
      expect.arrayContaining(['flowchart-chart', 'flowchart-step-type', 'flowchart-direction']),
    );
    expect(expanded('Direction')).toBe('true');
    expect(expanded('Chart')).toBe('false');
  });

  it('leaves Step Type out on a lane', () => {
    renderMenu({ stepType: undefined }, false);
    expect(screen.queryByRole('button', { name: 'Step Type' })).toBeNull();
    expect(expanded('Chart')).toBe('false');
  });

  it('runs the chart actions and the picks', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Add Lane/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tidy Flowchart/ }));
    expect(props.onAddLane).toHaveBeenCalledTimes(1);
    expect(props.onTidy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: /Decision/ }));
    expect(props.onSetStepType).toHaveBeenCalledWith('decision');
    fireEvent.click(screen.getByRole('radio', { name: /Right/ }));
    expect(props.onSetDirection).toHaveBeenCalledWith('right');
  });
});
