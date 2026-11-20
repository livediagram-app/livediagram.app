// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: Parameters<typeof trackMock>) => trackMock(...a),
}));

const { useDockPopovers } = await import('./useDockPopovers');

const button = () => document.createElement('button');

// docs/specs/017-telemetry/telemetry.md: the popover layouts open Collaborate and Contents here rather
// than through the desktop un-minimise toggle, so they count here.
describe('useDockPopovers panel-open telemetry', () => {
  beforeEach(() => trackMock.mockReset());

  it('counts a Collaborate and a Contents open through the popover path', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('collaborate', button()));
    act(() => result.current.handleDockButtonClick('contents', button()));
    expect(trackMock.mock.calls).toEqual([
      ['UI', 'Opened', 'Collaborate'],
      ['UI', 'Opened', 'PageContents'],
    ]);
  });

  it('does not count a close', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('collaborate', button()));
    act(() => result.current.handleDockButtonClick('collaborate', button()));
    expect(trackMock).toHaveBeenCalledOnce();
    expect(result.current.activeDockPanel).toBeNull();
  });

  it('counts nothing for the Explorer', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('explorer', button()));
    expect(trackMock).not.toHaveBeenCalled();
    expect(result.current.activeDockPanel).toBe('explorer');
  });
});

// A popover's width here is what its anchor clamps against, so it must be the width the panel draws, or a panel
// wider than the table says runs off the right edge (the Photo panel did, at 360 px against 280).
describe('the popover width table', () => {
  it('matches each panel’s drawn width', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { POPOVER_WIDTHS } = await import('./useDockPopovers');
    // Vitest runs from the app's folder.
    const drawn = (file: string) => {
      const src = readFileSync(join(process.cwd(), 'components', file), 'utf8');
      return Number(/popoverWidth="w-\[(\d+)px\]"/.exec(src)?.[1]);
    };
    expect(POPOVER_WIDTHS['photo-panel']).toBe(drawn('photo/PhotoPanel.tsx'));
    expect(POPOVER_WIDTHS.contents).toBe(drawn('canvas/PageContentsPanel.tsx'));
  });
});
