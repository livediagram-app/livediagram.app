// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { MOTION_MS } from '@livedesign/tailwind-config/motion';
import { useSlotEnter } from './useSlotEnter';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a slot added settles into place; a Dashboard opening draws still.
function Slot({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useSlotEnter(ref, index);
  return <div ref={ref} />;
}

const animate = vi.fn();

function mount(ready: boolean, index = 0) {
  HTMLElement.prototype.animate = animate;
  return render(
    <div {...(ready ? { 'data-dashboard-ready': '' } : {})}>
      <Slot index={index} />
    </div>,
  );
}

afterEach(() => {
  animate.mockReset();
  document.documentElement.classList.remove('reduce-motion');
});

describe('a slot settling into place', () => {
  it('animates a slot added to a page that is up, at the long token', () => {
    mount(true);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]![1]).toMatchObject({ duration: MOTION_MS.long, delay: 0 });
  });

  it('cascades a new row’s later slots, landing by the motion ceiling', () => {
    mount(true, 3);
    const opts = animate.mock.calls[0]![1] as { duration: number; delay: number };
    expect(opts.delay).toBeGreaterThan(0);
    expect(opts.delay + opts.duration).toBeLessThanOrEqual(MOTION_MS.long);
  });

  it('draws the slots a Dashboard opens with still', () => {
    mount(false);
    expect(animate).not.toHaveBeenCalled();
  });

  it('never moves under reduced motion', () => {
    document.documentElement.classList.add('reduce-motion');
    mount(true);
    expect(animate).not.toHaveBeenCalled();
  });
});
