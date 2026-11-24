// @vitest-environment jsdom
// Send to a Plan (docs/specs/013-workspace/suggestions.md): a call that ends with stickies on the tab it met on offers
// an Editor Send to Plan on all of them; nothing before a call ends or with no stickies; never to a Participant, a
// Viewer or a guest.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { maySuggestTo } from '@liveworkspace/workbench/components/suggest/suggest-gate';
import { resetSuggestionMemoryForTests } from '@liveworkspace/workbench/components/suggest/suggest-memory';
import { resetSuggestionShowingForTests } from '@liveworkspace/workbench/components/suggest/useSuggestion';
import {
  SUGGEST_CHECK_MS,
  SUGGEST_IDLE_MS,
} from '@liveworkspace/workbench/components/suggest/suggestions';

const store = vi.hoisted(() => {
  let phase = 'off';
  const listeners = new Set<() => void>();
  return {
    set(next: string) {
      phase = next;
      for (const l of [...listeners]) l();
    },
    callSelf: () => ({ phase }),
    onCallSelf: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});
vi.mock('@/lib/calls/calls-store', () => ({
  callSelf: store.callSelf,
  onCallSelf: store.onCallSelf,
}));

const send = vi.hoisted(() => ({ run: vi.fn(), sendAllStickies: vi.fn() }));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-menu-item', () => ({
  sendAllStickies: send.sendAllStickies,
  elementWords: (e: { label?: unknown }) => (typeof e.label === 'string' ? e.label.trim() : ''),
}));

import { SendToPlanSuggestion } from './SendToPlanSuggestion';

const wall = (id: string, labels: string[]) =>
  ({
    id,
    elements: labels.map((label, i) => ({ id: `${id}s${i}`, type: 'sticky', label, x: 0, y: i })),
  }) as unknown as Tab;

const tabs = [wall('t1', ['Book the room', 'Draft the plan', ' ']), wall('t2', [])];
const session = { readOnly: false, signedIn: true };

async function idle(ms = SUGGEST_IDLE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

const mount = (allowed: boolean, activeId = 't1') =>
  render(<SendToPlanSuggestion itemId="S1" allowed={allowed} activeId={activeId} tabs={tabs} />);

beforeEach(() => {
  vi.useFakeTimers();
  resetSuggestionMemoryForTests();
  resetSuggestionShowingForTests();
  store.set('off');
  send.sendAllStickies.mockImplementation((_tab: string, els: { label: string }[]) =>
    els.some((e) => e.label.trim()) ? send.run : null,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SendToPlanSuggestion', () => {
  it('offers an Editor the stickies of the tab the call ended on, and sends them', async () => {
    mount(maySuggestTo({ ...session, level: 'edit' }));
    await idle(SUGGEST_CHECK_MS);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => store.set('live'));
    act(() => store.set('live'));
    act(() => store.set('off'));
    await idle();
    expect(screen.getByText('Send to a Plan')).toBeTruthy();
    expect(screen.getByText(/ended with 2 stickies on the wall/)).toBeTruthy();
    expect(send.sendAllStickies).toHaveBeenCalledWith('t1', tabs[0]!.elements);
    fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
    await act(async () => {});
    expect(send.run).toHaveBeenCalledTimes(1);
  });

  it('keeps to the tab the call was on, and offers nothing for a wall with no stickies', async () => {
    store.set('live');
    const view = mount(true, 't2');
    view.rerender(<SendToPlanSuggestion itemId="S1" allowed activeId="t2" tabs={tabs} />);
    act(() => store.set('off'));
    await idle();
    expect(screen.queryByRole('status')).toBeNull();
    expect(send.sendAllStickies).toHaveBeenCalledWith('t2', []);
  });

  it('names one sticky as one', async () => {
    const one = [wall('t1', ['Only one'])];
    render(<SendToPlanSuggestion itemId="S1" allowed activeId="t1" tabs={one} />);
    act(() => store.set('live'));
    act(() => store.set('off'));
    await idle();
    expect(screen.getByText(/ended with a sticky on the wall\. Send it/)).toBeTruthy();
  });

  it.each(['participate', 'view'])('is never offered to a %s, nor a guest', async (level) => {
    for (const allowed of [
      maySuggestTo({ ...session, level, readOnly: true }),
      maySuggestTo({ ...session, level: 'edit', signedIn: false }),
    ]) {
      const view = mount(allowed);
      act(() => store.set('live'));
      act(() => store.set('off'));
      await idle();
      expect(screen.queryByRole('status')).toBeNull();
      view.unmount();
    }
  });
});
