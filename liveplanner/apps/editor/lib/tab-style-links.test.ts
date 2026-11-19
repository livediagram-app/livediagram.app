import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setBoardConfiguring, useBoardConfiguring } from '@/hooks/plan/board-configure-store';
import {
  BOARD_CONFIGURE_LINK,
  DASHBOARD_SETTINGS_LINK,
  SHEET_SETTINGS_LINK,
} from './tab-style-links';

// docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's profile": each tab kind's Fine-tune link
// opens the setting that really styles it.
afterEach(() => {
  document.body.innerHTML = '';
  setBoardConfiguring(false);
});

describe('the Tab Style links', () => {
  it("opens the board's Configure", () => {
    const { result, rerender } = renderHook(() => useBoardConfiguring());
    expect(result.current).toBe(false);
    BOARD_CONFIGURE_LINK.onOpen();
    rerender();
    expect(result.current).toBe(true);
  });

  it("presses the Sheet's and the Dashboard's own cog", () => {
    document.body.innerHTML = `
      <div data-plan-sheet="s"><button aria-label="Sheet Settings"></button></div>
      <div data-dashboard-settings><button aria-label="Dashboard Settings"></button></div>`;
    const [sheet, dashboard] = [...document.querySelectorAll('button')];
    const onSheet = vi.fn();
    const onDashboard = vi.fn();
    sheet!.addEventListener('click', onSheet);
    dashboard!.addEventListener('click', onDashboard);
    SHEET_SETTINGS_LINK.onOpen();
    DASHBOARD_SETTINGS_LINK.onOpen();
    expect(onSheet).toHaveBeenCalledOnce();
    expect(onDashboard).toHaveBeenCalledOnce();
  });

  it('does nothing when the cog is not on screen', () => {
    expect(() => SHEET_SETTINGS_LINK.onOpen()).not.toThrow();
  });
});
