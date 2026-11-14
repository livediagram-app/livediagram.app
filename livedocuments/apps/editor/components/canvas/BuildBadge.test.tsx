// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Slide, Tab } from '@livedocuments/document';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { BuildBadge } from './element-parts';
import { BuildStepsProvider, useBuildStep } from './BuildStepsContext';

// docs/specs/012-collaboration/presentation-mode.md "Setting builds up": each built element carries its step number,
// as editor chrome only (never while presenting or in an embed, nor at overview zooms).

afterEach(cleanup);

const badge = (c: HTMLElement) => c.querySelector('[data-build-badge]');

describe('BuildBadge', () => {
  it('shows the step, beside the lock badge when both show', () => {
    const { container, rerender } = render(<BuildBadge step={2} besideLock={false} />);
    expect(badge(container)?.textContent).toBe('2');
    expect(badge(container)?.className).toContain('-left-2');
    rerender(<BuildBadge step={2} besideLock />);
    expect(badge(container)?.className).toContain('left-4');
  });

  it('hides while presenting or in an embed, and at overview zooms', () => {
    const { container } = render(
      <SuppressElementIndicators when>
        <BuildBadge step={1} besideLock={false} />
      </SuppressElementIndicators>,
    );
    expect(container.innerHTML).toBe('');
    cleanup();
    const far = render(
      <CanvasZoomProvider zoom={0.05}>
        <BuildBadge step={1} besideLock={false} />
      </CanvasZoomProvider>,
    );
    expect(far.container.innerHTML).toBe('');
  });
});

describe('BuildStepsProvider', () => {
  const tabWith = (order: number): Tab =>
    ({
      id: 't',
      name: 't',
      elements: [
        {
          id: 'a',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          build: { order, effect: 'fade' },
        },
      ],
    }) as unknown as Tab;
  const slides: Slide[] = [{ id: 's', tabId: 't', elementIds: ['a'] }];
  function Probe() {
    return <span data-testid="step">{useBuildStep('a') ?? 'none'}</span>;
  }

  it('numbers an element by its step, and none without a deck', () => {
    const { getByTestId, rerender } = render(
      <BuildStepsProvider slides={slides} tab={tabWith(7)}>
        <Probe />
      </BuildStepsProvider>,
    );
    expect(getByTestId('step').textContent).toBe('1');
    // A new tab with the same numbers keeps the step.
    rerender(
      <BuildStepsProvider slides={slides} tab={tabWith(3)}>
        <Probe />
      </BuildStepsProvider>,
    );
    expect(getByTestId('step').textContent).toBe('1');
    rerender(
      <BuildStepsProvider slides={undefined} tab={tabWith(3)}>
        <Probe />
      </BuildStepsProvider>,
    );
    expect(getByTestId('step').textContent).toBe('none');
  });
});
