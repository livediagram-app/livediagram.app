// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setBoardConfiguring, useBoardConfiguring } from '@/hooks/plan/board-configure-store';
import {
  BOARD_CONFIGURE_LINK,
  DASHBOARD_SETTINGS_LINK,
  FORM_SETTINGS_LINK,
  SHEET_SETTINGS_LINK,
} from './tab-style-links';
import { takeOpenOn } from './settings-open-on';

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

  it("presses the Sheet's, the Form's and the Dashboard's own cog", () => {
    document.body.innerHTML = `
      <div data-plan-sheet="s"><button aria-label="Sheet Settings"></button></div>
      <div data-form-status><button aria-label="Form Settings"></button></div>
      <div data-dashboard-settings><button aria-label="Dashboard Settings"></button></div>`;
    const [sheet, form, dashboard] = [...document.querySelectorAll('button')];
    const onSheet = vi.fn();
    const onForm = vi.fn();
    const onDashboard = vi.fn();
    sheet!.addEventListener('click', onSheet);
    form!.addEventListener('click', onForm);
    dashboard!.addEventListener('click', onDashboard);
    SHEET_SETTINGS_LINK.onOpen();
    DASHBOARD_SETTINGS_LINK.onOpen();
    FORM_SETTINGS_LINK.onOpen();
    expect(onSheet).toHaveBeenCalledOnce();
    expect(onForm).toHaveBeenCalledOnce();
    expect(onDashboard).toHaveBeenCalledOnce();
  });

  it('asks the Sheet for Sheet Options and the Form for its Settings as it presses their cog', () => {
    document.body.innerHTML = `
      <div data-plan-sheet="s"><button aria-label="Sheet Settings"></button></div>
      <div data-form-status><button aria-label="Form Settings"></button></div>`;
    const [sheet, form] = [...document.querySelectorAll('button')];
    let sheetAsked: string | null = null;
    let formAsked: string | null = null;
    sheet!.addEventListener('click', () => (sheetAsked = takeOpenOn('sheet')));
    form!.addEventListener('click', () => (formAsked = takeOpenOn('form')));
    SHEET_SETTINGS_LINK.onOpen();
    FORM_SETTINGS_LINK.onOpen();
    expect(sheetAsked).toBe('view');
    expect(formAsked).toBe('settings');
    // Taken once: a later press of either cog opens as it always does.
    expect(takeOpenOn('sheet')).toBeNull();
    expect(takeOpenOn('form')).toBeNull();
  });

  it('does nothing when the cog is not on screen, and drops its ask', () => {
    expect(() => SHEET_SETTINGS_LINK.onOpen()).not.toThrow();
    expect(() => FORM_SETTINGS_LINK.onOpen()).not.toThrow();
    expect(takeOpenOn('sheet')).toBeNull();
    expect(takeOpenOn('form')).toBeNull();
  });
});
