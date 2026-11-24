// @vitest-environment jsdom
// Make These a Plan (docs/specs/013-workspace/suggestions.md): an Editor who may send is offered Send to Plan on a
// tab's action stickies once there are 3; a Participant, a Viewer or a guest never is; taking it opens the picker on
// all of them.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maySuggestTo } from '@liveworkspace/workbench/components/suggest/suggest-gate';
import { resetSuggestionMemoryForTests } from '@liveworkspace/workbench/components/suggest/suggest-memory';
import { resetSuggestionShowingForTests } from '@liveworkspace/workbench/components/suggest/useSuggestion';
import { SUGGEST_CHECK_MS } from '@liveworkspace/workbench/components/suggest/suggestions';

const { sendElements, canSendHere } = vi.hoisted(() => ({
  sendElements: vi.fn(),
  canSendHere: vi.fn(() => true),
}));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-menu-item', () => ({
  sendElements,
}));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry', () => ({
  canSendHere,
}));

import { MakePlanSuggestion } from './MakePlanSuggestion';

const actions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    type: 'sticky',
    label: `Action ${i}`,
    x: 0,
    y: i * 120,
    width: 100,
    height: 100,
    action: { status: 'open' },
  }));

const session = { readOnly: false, signedIn: true };

beforeEach(() => {
  vi.useFakeTimers();
  resetSuggestionMemoryForTests();
  resetSuggestionShowingForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function idle() {
  await act(async () => {
    vi.advanceTimersByTime(SUGGEST_CHECK_MS);
    await Promise.resolve();
  });
}

describe('MakePlanSuggestion', () => {
  it('offers an Editor Send to Plan on 3 action stickies, and sends all of them', async () => {
    render(
      <MakePlanSuggestion
        itemId="D1"
        allowed={maySuggestTo({ ...session, level: 'edit' })}
        elements={actions(3)}
      />,
    );
    await idle();
    expect(screen.getByText('Make These a Plan')).toBeTruthy();
    expect(screen.getByText(/3 action stickies here/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
    await act(async () => {});
    expect(sendElements).toHaveBeenCalledWith(actions(3));
  });

  it('waits for the third, and for a session that may send', async () => {
    const view = render(<MakePlanSuggestion itemId="D1" allowed elements={actions(2)} />);
    await idle();
    expect(screen.queryByRole('status')).toBeNull();
    canSendHere.mockReturnValue(false);
    view.rerender(<MakePlanSuggestion itemId="D1" allowed elements={actions(5)} />);
    await idle();
    expect(screen.queryByRole('status')).toBeNull();
    canSendHere.mockReturnValue(true);
    await idle();
    expect(screen.getByText(/5 action stickies here/)).toBeTruthy();
  });

  it.each(['participate', 'view'])('is never offered to a %s, nor a guest', async (level) => {
    for (const allowed of [
      maySuggestTo({ ...session, level }),
      maySuggestTo({ ...session, level: 'edit', signedIn: false }),
    ]) {
      expect(allowed).toBe(false);
      const view = render(
        <MakePlanSuggestion itemId="D1" allowed={allowed} elements={actions(4)} />,
      );
      await idle();
      expect(screen.queryByRole('status')).toBeNull();
      view.unmount();
    }
  });
});
