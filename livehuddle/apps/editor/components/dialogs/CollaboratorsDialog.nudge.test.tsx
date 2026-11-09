// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { AccessLevel } from '@livehuddle/api-schema';
import type { Participant } from '@/lib/identity';
import { bindWorkbench } from '@/lib/workbench-bindings';
import { resetNudges, sendNudge, setNudgeSender } from '@/lib/nudge/nudge-inbox';
import { CollaboratorsDialog } from './CollaboratorsDialog';

// Nudge (docs/specs/012-collaboration/nudge.md "Nudging", "Share roles"): a Nudge on each other person's row for an
// Editor or a Participant, never on your own and never for a Viewer; after a nudge it reads Nudged and counts down.

const person = (id: string, name: string, extra: Partial<Participant> = {}): Participant => ({
  id,
  name,
  color: '#0ea5e9',
  status: 'online',
  ...extra,
});
const tabs = [{ id: 't1', name: 'Overview' }] as unknown as Tab[];

function open(selfRole: AccessLevel, onNudge?: (t: unknown) => void, people?: Participant[]) {
  bindWorkbench();
  return render(
    <CollaboratorsDialog
      participantsByTab={
        new Map([['t1', people ?? [person('me', 'Me'), person('sam', 'Sam', { key: 'k-sam' })]]])
      }
      tabs={tabs}
      activeId="t1"
      selfId="me"
      selfRole={selfRole}
      focusId={null}
      followingId={null}
      onFollow={vi.fn()}
      onStopFollowing={vi.fn()}
      {...(onNudge ? { onNudge } : {})}
      facilitatorId={null}
      isFacilitator={false}
      isOwner={false}
      onMakeFacilitator={vi.fn()}
      onTakeFacilitation={vi.fn()}
      onStepDown={vi.fn()}
      onGoToTab={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  resetNudges();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CollaboratorsDialog: Nudge', () => {
  it.each(['edit', 'participate'] as const)(
    'offers a %s session a Nudge for others only',
    (role) => {
      const onNudge = vi.fn();
      open(role, onNudge);
      const buttons = screen.getAllByRole('button', { name: /^Nudge / });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]!.getAttribute('aria-label')).toBe('Nudge Sam');
      fireEvent.click(buttons[0]!);
      expect(onNudge).toHaveBeenCalledWith({ id: 'sam', key: 'k-sam', name: 'Sam' });
    },
  );

  it('shows a Viewer no Nudge', () => {
    open('view', vi.fn());
    expect(screen.queryByRole('button', { name: /Nudge/ })).toBeNull();
  });

  it('shows no Nudge without a way to send one', () => {
    open('edit');
    expect(screen.queryByRole('button', { name: /Nudge/ })).toBeNull();
  });

  it("never offers a Nudge on an agent's row", () => {
    open('edit', vi.fn(), [person('me', 'Me'), person('bot', "Sam's Agent", { agent: true })]);
    expect(screen.queryByRole('button', { name: /Nudge/ })).toBeNull();
  });

  it('reads Nudged after a nudge, counts down each second, and comes back after 2 minutes', () => {
    const onNudge = vi.fn();
    setNudgeSender(vi.fn());
    open('edit', onNudge);
    // The modal's own clocks (its "Active 2 mins ago"), so the countdown's tick is counted apart from them.
    const before = vi.getTimerCount();
    act(() => {
      sendNudge({ id: 'sam', key: 'k-sam', name: 'Sam' });
    });
    const cooling = screen.getByRole('button', { name: /Nudged Sam/ });
    expect(cooling.textContent).toBe('Nudged');
    expect(cooling.getAttribute('aria-disabled')).toBe('true');
    expect(cooling.getAttribute('aria-label')).toBe('Nudged Sam, nudge again in 2:00');
    fireEvent.click(cooling);
    expect(onNudge).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(18_000);
    });
    expect(screen.getByRole('button', { name: /Nudged Sam/ }).getAttribute('aria-label')).toBe(
      'Nudged Sam, nudge again in 1:42',
    );
    act(() => {
      vi.advanceTimersByTime(102_000);
    });
    expect(screen.getByRole('button', { name: 'Nudge Sam' })).toBeTruthy();
    // The countdown stops ticking once it is over.
    expect(vi.getTimerCount()).toBeLessThanOrEqual(before);
  });
});
