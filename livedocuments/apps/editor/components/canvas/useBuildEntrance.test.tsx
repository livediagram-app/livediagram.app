// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_ENTER_MS,
  BUILD_RISE_PX,
  buildKeyframes,
  useBuildEntrance,
  type BuildEntrance,
} from './useBuildEntrance';

// docs/specs/012-collaboration/presentation-mode.md "Builds": the step's own elements fade or rise in, once per step;
// Appear and reduced motion cut in.
const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.on,
}));

const animate = vi.fn();
beforeEach(() => {
  reduced.on = false;
  animate.mockClear();
  Element.prototype.animate = animate;
});
afterEach(cleanup);

function Slide({ entrance }: { entrance: BuildEntrance | null }) {
  const ref = useRef<HTMLElement>(null);
  useBuildEntrance(entrance, ref);
  return (
    <main ref={ref}>
      <div data-element-id="a" />
      <div data-element-id="b" />
      <svg>
        <g data-testid="arrow-group">
          <path data-element-id="arrow" />
        </g>
      </svg>
    </main>
  );
}

const targets = () => animate.mock.contexts as Element[];

describe('useBuildEntrance', () => {
  it("plays each element's effect once per step, an arrow on its group", () => {
    const step = {
      key: {},
      items: [
        { id: 'a', effect: 'fade' as const },
        { id: 'b', effect: 'appear' as const },
        { id: 'arrow', effect: 'rise' as const },
      ],
    };
    const view = render(<Slide entrance={step} />);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(targets()[0]!.getAttribute('data-element-id')).toBe('a');
    expect(targets()[1]!.getAttribute('data-testid')).toBe('arrow-group');
    expect(animate.mock.calls[0]![1]).toMatchObject({ duration: BUILD_ENTER_MS });
    // The same step re-rendered (a peer's edit) plays nothing again; a new step does.
    const next = { ...step, key: {} };
    view.rerender(<Slide entrance={next} />);
    expect(animate).toHaveBeenCalledTimes(4);
    const again = { key: next.key, items: [...step.items] };
    view.rerender(<Slide entrance={again} />);
    expect(animate).toHaveBeenCalledTimes(4);
  });

  it('cuts in under reduced motion, and without a step or a node', () => {
    reduced.on = true;
    render(<Slide entrance={{ key: {}, items: [{ id: 'a', effect: 'fade' }] }} />);
    cleanup();
    reduced.on = false;
    render(<Slide entrance={null} />);
    render(<Slide entrance={{ key: {}, items: [{ id: 'gone', effect: 'fade' }] }} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('keyframes: Fade from clear, Rise from below, Appear none', () => {
    expect(buildKeyframes('fade')).toEqual([{ opacity: 0 }, {}]);
    expect(buildKeyframes('rise')).toEqual([{ opacity: 0, translate: `0 ${BUILD_RISE_PX}px` }, {}]);
    expect(buildKeyframes('appear')).toBeNull();
  });
});
