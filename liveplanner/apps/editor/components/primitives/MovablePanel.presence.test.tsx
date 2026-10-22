// @vitest-environment jsdom
// docs/specs/008-canvas/quick-style-panel.md "Collisions": a panel arriving or leaving with no gesture of its own (the
// Map with the canvas's first content) has the chrome placed around the panels measure again.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
// jsdom has no ResizeObserver; the panel's measuring is not under test here.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

import { PANEL_PRESENCE_EVENT } from '@/lib/panel-presence';
import { MovablePanel } from './MovablePanel';

afterEach(cleanup);

describe('MovablePanel presence', () => {
  it('announces itself as it arrives and as it leaves', () => {
    const heard = vi.fn();
    window.addEventListener(PANEL_PRESENCE_EVENT, heard);
    const { unmount } = render(
      <MovablePanel title="Map" position={null} defaultCorner="bottom-left" onMoveTo={() => {}}>
        <p>body</p>
      </MovablePanel>,
    );
    expect(heard).toHaveBeenCalledTimes(1);
    unmount();
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(PANEL_PRESENCE_EVENT, heard);
  });
});
