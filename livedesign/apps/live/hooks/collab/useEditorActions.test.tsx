// @vitest-environment jsdom

// The action mutators (docs/specs/012-collaboration/assigned-actions.md): an element keeps one action, addressed by id.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, elementActions, type Tab } from '@livedesign/design';

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
      self: { userId: 'u-me', name: 'Me' },
      notify,
    }),
  );
  return { result, list: (id: string) => elementActions(find(id)), raw: find, notify };
}

describe('useEditorActions on an element', () => {
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

  it('closes it as Won’t Do, sets a status from the dialog, and tells the board a new one was made', () => {
    const box = createShape('square', 0, 0);
    const onCreated = vi.fn();
    const { result, list } = setup([box], onCreated);
    act(() => result.current.saveAction(box.id, input('First')));
    expect(onCreated).toHaveBeenCalledTimes(1);
    const first = list(box.id)[0]!;
    act(() => result.current.wontDoAction(box.id, first.id));
    expect(list(box.id)[0]!.status).toBe('wont-do');
    act(() => result.current.saveAction(box.id, { ...input('First'), status: 'done' }, first.id));
    expect(list(box.id)[0]!.status).toBe('done');
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('does not re-create an action deleted while its edit dialog was open', () => {
    const box = createShape('square', 0, 0);
    const { result, list } = setup([box]);
    act(() => result.current.saveAction(box.id, input('Doomed')));
    const doomed = list(box.id)[0]!;
    act(() => result.current.openAssignActionDialog(box.id, doomed.id));
    act(() => result.current.deleteAction(box.id, doomed.id));
    act(() => result.current.saveAction(box.id, input('Doomed, edited'), doomed.id));
    expect(list(box.id)).toEqual([]);
    expect(result.current.assignActionFor).toBeNull();
  });
});

describe('useEditorActions telling a teammate', () => {
  it('asks for the notification on every new team assignee, the email only when the box is ticked', () => {
    const box = createShape('square', 0, 0);
    const { result, list, notify } = setup([box]);
    const team = {
      ...input('Ship it'),
      assignee: { userId: 'u-bea', name: 'Bea' },
      teamId: 'team1',
    };
    act(() => result.current.saveAction(box.id, team));
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: false,
        tabId: 't',
        elementId: box.id,
        assigneeUserId: 'u-bea',
      }),
    );
    // An edit that keeps the assignee asks nothing; a new assignee asks again, with the box ticked.
    act(() => result.current.saveAction(box.id, team, list(box.id)[0]!.id));
    expect(notify).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.saveAction(
        box.id,
        { ...team, assignee: { userId: 'u-cy', name: 'Cy' }, notifyEmail: true },
        list(box.id)[0]!.id,
      ),
    );
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: true, assigneeUserId: 'u-cy' }),
    );
    // A self-assignment has no team, and asks nothing.
    act(() => result.current.saveAction(box.id, input('Mine'), list(box.id)[0]!.id));
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
