// @vitest-environment jsdom
// UI scale (docs/specs/007-editor/ui-scale.md "Behaviour"): a panel is zoomed
// at its root, and a free-dragged panel stays at the screen position it was
// dropped at, so its stored screen-px position is written divided by the
// scale. A corner panel stays its design 16px from the corner.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
// jsdom has no ResizeObserver; the panel's measuring is not under test here.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

import { MovablePanel } from './MovablePanel';
import { UiScaleProvider, useUiScale } from '@/components/providers/ui-scale';

afterEach(cleanup);

function panel(
  scale: number | null,
  props: Partial<Parameters<typeof MovablePanel>[0]> = {},
): HTMLElement {
  const el: ReactNode = (
    <MovablePanel
      title="Layers"
      position={null}
      defaultCorner="top-left"
      onMoveTo={() => {}}
      {...props}
    >
      <p>body</p>
    </MovablePanel>
  );
  const { container } = render(
    scale === null ? (
      el
    ) : (
      // Only the panels part applies to a panel.
      <UiScaleProvider value={{ panels: scale, toolbar: 0.8, cornerButtons: 1.2 }}>
        {el}
      </UiScaleProvider>
    ),
  );
  return container.querySelector('[data-floating-panel]') as HTMLElement;
}

describe('MovablePanel at a UI scale', () => {
  it('is untouched outside a provider', () => {
    const root = panel(null, { position: { x: 300, y: 150 } });
    expect(root.style.zoom).toBe('');
    expect(root.style.left).toBe('300px');
    expect(root.style.top).toBe('150px');
  });

  it('zooms and keeps a dropped panel at its screen position', () => {
    const root = panel(1.5, { position: { x: 300, y: 150 } });
    expect(root.style.zoom).toBe('1.5');
    expect(root.style.left).toBe('200px');
    expect(root.style.top).toBe('100px');
  });

  it('keeps a corner panel 16px from its corner', () => {
    const root = panel(2, { defaultCorner: 'bottom-right' });
    expect(root.style.right).toBe('8px');
    expect(root.style.bottom).toBe('8px');
  });

  it('positions a popover from its screen-px anchor', () => {
    const root = panel(2, {
      asPopover: true,
      popoverOpen: true,
      popoverAnchor: { top: 40, left: 100, arrowOffset: 30 },
    });
    expect(root.style.zoom).toBe('2');
    expect(root.style.top).toBe('26px');
    expect(root.style.left).toBe('50px');
  });
});

describe('useUiScale', () => {
  it('is 1 with no provider', () => {
    let seen = 0;
    function Probe() {
      seen = useUiScale('panels');
      return null;
    }
    render(<Probe />);
    expect(seen).toBe(1);
  });
});
