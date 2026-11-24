// @vitest-environment jsdom
// A suggestion's rules end to end (liveworkspace/docs/specs/016-notifications/suggestions.md "Rules"): shown after an
// idle check, one at a time, never mid-gesture, never while another notice holds the slot, never with the switch off
// or for someone not allowed; taken, dismissed or turned off, it never comes back for the item; each counted.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests, workbench } from '../../bindings';
import { holdNoticeSlot } from '../../lib/notice-slot';
import { resetActivityForTests } from './suggest-activity';
import { maySuggest, resetSuggestionMemoryForTests } from './suggest-memory';
import { NextAppSuggestion } from './NextAppSuggestion';
import { SUGGEST_CHECK_MS, SUGGEST_IDLE_MS } from './suggestions';
import { resetSuggestionShowingForTests, type SuggestionCheck } from './useSuggestion';

const track = vi.fn();
let prefs: Record<string, unknown> = {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  resetSuggestionMemoryForTests();
  resetActivityForTests();
  resetSuggestionShowingForTests();
  prefs = {};
  configureWorkbench({
    ...workbench,
    track,
    readPreferences: () => prefs,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  resetWorkbenchForTests();
});

const found = (run = vi.fn()) => ({ line: '4 action stickies here could be cards.', run });

async function idle(ms = SUGGEST_IDLE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

function mount(
  check: SuggestionCheck,
  props: Partial<{ allowed: boolean; itemId: string | null }> = {},
) {
  return render(
    <NextAppSuggestion
      id="make-plan"
      itemId={props.itemId === undefined ? 'D1' : props.itemId}
      allowed={props.allowed ?? true}
      check={check}
    />,
  );
}

describe('NextAppSuggestion', () => {
  it('shows after an idle check, says what and why, and counts it shown once', async () => {
    const check = vi.fn(() => found());
    mount(check);
    expect(screen.queryByRole('status')).toBeNull();
    await idle();
    expect(screen.getByText('Make These a Plan')).toBeTruthy();
    expect(screen.getByText('4 action stickies here could be cards.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send to Plan' })).toBeTruthy();
    await idle(SUGGEST_CHECK_MS * 3);
    expect(check).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'SuggestMakePlan');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('takes it in one click, counts it, and never suggests it for the item again', async () => {
    const run = vi.fn();
    const check = vi.fn(() => found(run));
    mount(check);
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
    await act(async () => {});
    expect(run).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'SuggestMakePlan');
    expect(screen.queryByRole('status')).toBeNull();
    expect(maySuggest('make-plan', 'D1')).toBe(false);
    await idle(SUGGEST_CHECK_MS * 2);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('dismisses for this item with the × or Escape, and Don’t Suggest This Again for every item', async () => {
    const view = mount(() => found());
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'SuggestMakePlan');
    expect(maySuggest('make-plan', 'D1')).toBe(false);
    expect(maySuggest('make-plan', 'D2')).toBe(true);
    view.unmount();

    const second = mount(() => found(), { itemId: 'D2' });
    await idle();
    fireEvent.keyDown(screen.getByRole('status'), { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(maySuggest('make-plan', 'D2')).toBe(false);
    second.unmount();

    mount(() => found(), { itemId: 'D3' });
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Don’t Suggest This Again' }));
    expect(maySuggest('make-plan', 'D9')).toBe(false);
  });

  it('waits while the person types or drags', async () => {
    const check = vi.fn(() => found());
    mount(check);
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    await idle(SUGGEST_CHECK_MS * 2);
    expect(check).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new Event('pointerup'));
    });
    await idle(SUGGEST_CHECK_MS);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('waits while another notice holds the slot, and shows one suggestion at a time', async () => {
    const release = holdNoticeSlot();
    const check = vi.fn(() => found());
    render(
      <>
        <NextAppSuggestion id="make-plan" itemId="D1" allowed check={check} />
        <NextAppSuggestion id="write-up" itemId="D1" allowed check={() => found()} />
      </>,
    );
    await idle(SUGGEST_CHECK_MS);
    expect(screen.queryByRole('status')).toBeNull();
    release();
    await idle(SUGGEST_CHECK_MS);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('shows nothing with the switch off, to someone not allowed, or before the item is known', async () => {
    prefs = { suggestNextApp: false };
    const check = vi.fn(() => found());
    const view = mount(check);
    await idle(SUGGEST_CHECK_MS);
    expect(check).not.toHaveBeenCalled();
    view.unmount();
    prefs = {};
    const notAllowed = mount(check, { allowed: false });
    await idle(SUGGEST_CHECK_MS);
    notAllowed.unmount();
    mount(check, { itemId: null });
    await idle(SUGGEST_CHECK_MS);
    expect(check).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('goes, undecided, when the person is no longer allowed', async () => {
    const view = mount(() => found());
    await idle();
    expect(screen.getByRole('status')).toBeTruthy();
    view.rerender(
      <NextAppSuggestion id="make-plan" itemId="D1" allowed={false} check={() => found()} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(maySuggest('make-plan', 'D1')).toBe(true);
  });

  it('goes, undecided, when the switch is turned off while it shows, and comes back when on again', async () => {
    mount(() => found());
    await idle();
    expect(screen.getByRole('status')).toBeTruthy();
    await idle(SUGGEST_CHECK_MS);
    expect(screen.getByRole('status')).toBeTruthy();
    prefs = { suggestNextApp: false };
    await idle(SUGGEST_CHECK_MS);
    expect(screen.queryByRole('status')).toBeNull();
    expect(maySuggest('make-plan', 'D1')).toBe(true);
    await idle(SUGGEST_CHECK_MS);
    expect(screen.queryByRole('status')).toBeNull();
    prefs = {};
    await idle(SUGGEST_CHECK_MS);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('takes an async check, and suggests nothing for one that finds nothing or fails', async () => {
    const check = vi
      .fn<SuggestionCheck>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(null)
      .mockResolvedValue(found());
    mount(check);
    await idle();
    await idle(SUGGEST_CHECK_MS);
    expect(screen.queryByRole('status')).toBeNull();
    await idle(SUGGEST_CHECK_MS);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('stops checking an item already decided', async () => {
    const view = mount(() => found());
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    view.unmount();
    const check = vi.fn(() => found());
    mount(check);
    await idle(SUGGEST_CHECK_MS * 3);
    expect(check).not.toHaveBeenCalled();
  });
});
