// @vitest-environment jsdom
// Steps in other apps in the builder (blueprint cross-app.md "In the builder", "Picking the target"): the picker's
// View Only rows, the target's read-once cache, the rule's Runs As / Reaches / Limits card and the group's marks.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { CROSS_APP_GROUP, CROSS_APP_KINDS } from '@liveworkspace/automations/cross-app';
import { CrossAppRuleCard, reachesOf } from './CrossAppRuleCard';
import { CROSS_APP_FOOTNOTE, CROSS_APP_GROUP_ID, crossAppGroup } from './cross-app-group';
import {
  TargetPicker,
  VIEW_ONLY,
  VIEW_ONLY_REASON,
  targetItems,
  targetRowState,
} from './TargetPicker';
import { TARGET_CACHE_MAX, forgetTargets, readTarget, useCrossTarget } from './use-cross-target';

const item = (id: string, app: Item['app'], title: string, access: Item['access'] = 'edit') =>
  ({
    id,
    app,
    title,
    access,
    updatedAt: Date.UTC(2026, 10, 20),
    lastOpenedAt: null,
  }) as unknown as Item;

const ITEMS = [
  item('p1', 'liveplanner', 'Launch Board'),
  item('p2', 'liveplanner', 'Finance Plan', 'view'),
  item('k1', 'liveknowledge', 'Handbook'),
];

afterEach(() => forgetTargets());

describe('the target picker', () => {
  it('offers only what the person edits, the rest View Only with a lock and why', () => {
    expect(targetRowState({ access: 'edit' })).toEqual({ kind: 'open' });
    expect(targetRowState({ access: 'view' })).toEqual({
      kind: 'blocked',
      reason: VIEW_ONLY_REASON,
      lock: VIEW_ONLY,
    });
    expect(targetItems(ITEMS, ['liveplanner'], '').map((i) => i.id)).toEqual(['p1', 'p2']);
    expect(targetItems(ITEMS, ['liveplanner'], ' finance ').map((i) => i.id)).toEqual(['p2']);
  });

  it('lists the recent plans, locks the one only viewed, and picks an editable one', async () => {
    const listItems = vi.fn(async () => ({ items: ITEMS, nextCursor: null }));
    const onPick = vi.fn();
    render(
      <TargetPicker
        client={{ listItems }}
        hostId="d1"
        apps={['liveplanner']}
        noun="plan"
        now={Date.UTC(2026, 10, 22)}
        onPick={onPick}
        onClose={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Pick a plan' });
    await within(dialog).findByText('Launch Board');
    expect(within(dialog).queryByText('Handbook')).toBeNull();
    expect(within(dialog).getByText(VIEW_ONLY)).toBeTruthy();
    fireEvent.click(within(dialog).getByText('Launch Board').closest('button')!);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Find a plan' }), {
      target: { value: 'nothing like it' },
    });
    expect(within(dialog).getByText('No plan matches “nothing like it”')).toBeTruthy();
  });
});

describe('a target read', () => {
  it('reads each item once, keeps only the newest few, and reads a failed one again', async () => {
    const automationTarget = vi.fn(
      async (id: string) => ({ app: 'liveplanner', title: id }) as never,
    );
    const client = { automationTarget };
    await readTarget(client, 'a');
    await readTarget(client, 'a');
    expect(automationTarget).toHaveBeenCalledTimes(1);
    // A bounded cache: past TARGET_CACHE_MAX the oldest is read again.
    for (let i = 0; i < TARGET_CACHE_MAX; i += 1) await readTarget(client, `x${i}`);
    await readTarget(client, 'a');
    expect(automationTarget).toHaveBeenCalledTimes(TARGET_CACHE_MAX + 2);
    const failing = { automationTarget: vi.fn(async () => Promise.reject(new Error('gone'))) };
    await expect(readTarget(failing, 'z')).rejects.toThrow('gone');
    await expect(readTarget(failing, 'z')).rejects.toThrow('gone');
    expect(failing.automationTarget).toHaveBeenCalledTimes(2);
  });

  it('answers none, loading, ready, and failed with Try Again', async () => {
    let fail = true;
    const client = {
      automationTarget: vi.fn(async () => {
        if (fail) throw new Error('no access');
        return { app: 'liveknowledge', title: 'Handbook', pages: [] } as never;
      }),
    };
    expect(renderHook(() => useCrossTarget(client, '')).result.current.state).toBe('none');
    const { result } = renderHook(() => useCrossTarget(client, 'k1'));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('failed'));
    fail = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toBe('ready'));
  });
});

describe('the rule’s card', () => {
  const plan = (id: string) => ({
    kind: 'plan_card',
    target: { app: 'liveplanner', item: id, title: id ? 'Launch Board' : '' },
  });
  const notice = { kind: 'inbox_notice', to: [{ person: 'p1' }], text: 'x' };

  it('lists each item reached once, the Inbox once, and nothing picked yet', () => {
    const steps = [plan('p1'), plan('p1'), plan(''), notice, notice, { kind: 'take_snapshot' }];
    expect(reachesOf({ steps })).toEqual([
      { key: 'p1:plan_card', title: 'Launch Board', app: 'liveplanner', what: 'Creates a card' },
      { key: 'inbox', title: 'Inbox', app: 'Every app', what: 'Notifies people' },
    ]);
  });

  it('says who it runs as, what it reaches and its limits, and opens its last runs', () => {
    const onRuns = vi.fn();
    const { rerender } = render(
      <CrossAppRuleCard body={{ steps: [plan('p1')] }} author="Ana Costa" onRuns={onRuns} />,
    );
    const card = screen.getByRole('region', { name: 'Steps in Other Apps' });
    expect(within(card).getByText('Ana Costa')).toBeTruthy();
    expect(card.textContent).toContain('Creates a card in Launch Board');
    expect(card.textContent).toContain('A chain stops after 3 hops');
    fireEvent.click(within(card).getByRole('button', { name: 'Last Runs in the Audit Trail' }));
    expect(onRuns).toHaveBeenCalled();
    rerender(<CrossAppRuleCard body={{ steps: [plan('')] }} author={null} />);
    expect(screen.getByText('You, once you save it. Lost access stops the rule.')).toBeTruthy();
    expect(screen.getByText('Nothing picked yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Last Runs in the Audit Trail' })).toBeNull();
    rerender(<CrossAppRuleCard body={{ steps: [{ kind: 'take_snapshot' }] }} author={null} />);
    expect(screen.queryByRole('region', { name: 'Steps in Other Apps' })).toBeNull();
  });
});

describe('the In Other Apps group', () => {
  it('holds the five steps, badged New, with who they act as under them', () => {
    expect(crossAppGroup()).toEqual({
      id: CROSS_APP_GROUP_ID,
      name: CROSS_APP_GROUP,
      kinds: [...CROSS_APP_KINDS],
      badge: 'New',
      footnote: CROSS_APP_FOOTNOTE,
    });
  });
});
