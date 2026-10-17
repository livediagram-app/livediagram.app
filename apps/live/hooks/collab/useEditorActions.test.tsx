// @vitest-environment jsdom

// The action mutators over an element's LIST (docs/specs/012-collaboration/action-panel.md "The data"): a card
// appends and addresses actions by id, an ordinary element keeps one.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ACTION_CARD_MAX,
  createElementAction,
  createShape,
  elementActions,
  type ElementAction,
  type Tab,
} from '@livediagram/document';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { useEditorActions, type SaveActionInput } from './useEditorActions';

const input = (name: string): SaveActionInput => ({
  name,
  description: '',
  assignee: { userId: 'u-me', name: 'Me' },
  teamId: null,
  notifyEmail: false,
});

function setup(elements: Tab['elements'], onCreated?: (elementId: string) => void) {
  const notify = vi.fn();
  let tabs: Tab[] = [{ id: 't', name: 'T', elements }];
  const find = (id: string) => tabs[0]!.elements.find((e) => e.id === id)!;
  const { result } = renderHook(() =>
    useEditorActions({
      activeId: 't',
      ...(onCreated ? { onCreated } : {}),
      tickTabs: (fn) => {
        tabs = fn(tabs);
      },
      getAction: (elementId, actionId) => {
        const list = elementActions(find(elementId));
        return actionId ? list.find((a) => a.id === actionId) : list[0];
      },
      isActionCard: (elementId) => {
        const el = find(elementId);
        return el.type === 'shape' && el.shape === 'action-card';
      },
      actionCount: (elementId) => elementActions(find(elementId)).length,
      self: { userId: 'u-me', name: 'Me' },
      notify,
    }),
  );
  return { result, list: (id: string) => elementActions(find(id)), raw: find, notify };
}

const legacy = (): ElementAction =>
  createElementAction({
    name: 'Old single action',
    description: '',
    assignee: { userId: 'u-me', name: 'Me' },
    teamId: null,
    assigner: { id: 'u-me', name: 'Me' },
  });

describe('useEditorActions on an Action panel', () => {
  it('appends each saved action, then completes and deletes one by id', () => {
    const card = createShape('action-card', 0, 0);
    const { result, list } = setup([card]);
    act(() => result.current.saveAction(card.id, input('First')));
    act(() => result.current.saveAction(card.id, input('Second')));
    expect(list(card.id).map((a) => a.name)).toEqual(['First', 'Second']);
    const second = list(card.id)[1]!;
    act(() => result.current.completeAction(card.id, second.id));
    expect(list(card.id).map((a) => a.status)).toEqual(['open', 'done']);
    act(() => result.current.deleteAction(card.id, list(card.id)[0]!.id));
    expect(list(card.id).map((a) => a.name)).toEqual(['Second']);
  });

  it('edits the named action and leaves the rest alone', () => {
    const card = createShape('action-card', 0, 0);
    const { result, list } = setup([card]);
    act(() => result.current.saveAction(card.id, input('First')));
    act(() => result.current.saveAction(card.id, input('Second')));
    const first = list(card.id)[0]!;
    act(() => result.current.saveAction(card.id, input('First, renamed'), first.id));
    expect(list(card.id).map((a) => a.name)).toEqual(['First, renamed', 'Second']);
  });

  it('closes one as Won’t Do, sets a status from the dialog, and tells the board a new one was made', () => {
    const card = createShape('action-card', 0, 0);
    const onCreated = vi.fn();
    const { result, list } = setup([card], onCreated);
    act(() => result.current.saveAction(card.id, input('First')));
    act(() => result.current.saveAction(card.id, input('Second')));
    expect(onCreated).toHaveBeenCalledTimes(2);
    const [first, second] = list(card.id);
    act(() => result.current.wontDoAction(card.id, first!.id));
    act(() =>
      result.current.saveAction(card.id, { ...input('Second'), status: 'done' }, second!.id),
    );
    expect(list(card.id).map((a) => a.status)).toEqual(['wont-do', 'done']);
    act(() => result.current.saveAction(card.id, { ...input('First'), status: 'open' }, first!.id));
    expect(list(card.id)[0]!.status).toBe('open');
    expect(onCreated).toHaveBeenCalledTimes(2);
  });

  it('migrates a card saved with a single action on its first edit', () => {
    const card = { ...createShape('action-card', 0, 0), action: legacy() };
    const { result, list, raw } = setup([card]);
    act(() => result.current.saveAction(card.id, input('Added')));
    expect(list(card.id).map((a) => a.name)).toEqual(['Old single action', 'Added']);
    expect('action' in raw(card.id)).toBe(false);
  });

  it('does not re-create an action deleted while its edit dialog was open', () => {
    const card = createShape('action-card', 0, 0);
    const { result, list } = setup([card]);
    act(() => result.current.saveAction(card.id, input('Doomed')));
    const doomed = list(card.id)[0]!;
    act(() => result.current.openAssignActionDialog(card.id, doomed.id));
    act(() => result.current.deleteAction(card.id, doomed.id));
    act(() => result.current.saveAction(card.id, input('Doomed, edited'), doomed.id));
    expect(list(card.id)).toEqual([]);
    expect(result.current.assignActionFor).toBeNull();
  });

  it('opens the add dialog from the Assign Action tile, never a popover', () => {
    const card = createShape('action-card', 0, 0);
    const { result } = setup([card]);
    act(() => result.current.openAssignAction(card.id));
    expect(result.current.assignActionFor).toBe(card.id);
    expect(result.current.assignActionId).toBeNull();
    expect(result.current.actionPopoverOpenId).toBeNull();
  });
});

describe('useEditorActions on an ordinary element', () => {
  it('keeps exactly one action, as `action`', () => {
    const box = createShape('square', 0, 0);
    const { result, list, raw } = setup([box]);
    act(() => result.current.saveAction(box.id, input('Only')));
    act(() => result.current.saveAction(box.id, input('Renamed')));
    expect(list(box.id).map((a) => a.name)).toEqual(['Renamed']);
    expect('actions' in raw(box.id)).toBe(false);
    act(() => result.current.deleteAction(box.id));
    expect('action' in raw(box.id)).toBe(false);
  });
});

// docs/specs/012-collaboration/action-panel.md "The data": a panel holds at most ACTION_CARD_MAX actions, and an add
// past that is refused whole: nothing stored, no email sent.
describe('a full Action panel', () => {
  it('refuses another action, and emails nobody about it', () => {
    const full = Array.from({ length: ACTION_CARD_MAX }, (_, i) => ({ ...legacy(), id: `a${i}` }));
    const card = {
      ...createShape('action-card', 0, 0),
      id: 'card',
      actions: full,
    } as Tab['elements'][number];
    const { result, list, notify } = setup([card]);
    act(() =>
      result.current.saveAction('card', {
        ...input('One too many'),
        teamId: 'team',
        notifyEmail: true,
      }),
    );
    expect(list('card')).toHaveLength(ACTION_CARD_MAX);
    expect(list('card').some((a) => a.name === 'One too many')).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
