import { describe, expect, it } from 'vitest';
import type { ElementAction, ShapeElement, Tab } from './index';
import { createElementAction, graftLiveTabState, isOpenAction } from './index';

const action = (overrides: Partial<ElementAction> = {}): ElementAction => ({
  id: 'act-1',
  name: 'Confirm the retry budget',
  description: '',
  assignee: { userId: 'user_2', name: 'Ada' },
  teamId: 'team-1',
  assignerId: 'user_1',
  assignerName: 'Sam',
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const shape = (id: string, act?: ElementAction): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...(act ? { action: act } : {}),
});

const tab = (id: string, elements: ShapeElement[]): Tab => ({
  id,
  name: id,
  elements,
});

describe('createElementAction', () => {
  it('mints an open action stamped with the assigner', () => {
    const created = createElementAction({
      name: 'Review the copy',
      description: 'Hero section only',
      assignee: { userId: 'user_2', name: 'Ada' },
      teamId: 'team-1',
      assigner: { id: 'user_1', name: 'Sam' },
    });
    expect(created.status).toBe('open');
    expect(created.assignerId).toBe('user_1');
    expect(created.assignee.userId).toBe('user_2');
    expect(created.createdAt).toBe(created.updatedAt);
    expect(created.id).toBeTruthy();
  });
});

describe('isOpenAction', () => {
  it('is true only for an open action', () => {
    expect(isOpenAction(undefined)).toBe(false);
    expect(isOpenAction(action())).toBe(true);
    expect(isOpenAction(action({ status: 'done' }))).toBe(false);
  });
});

describe('graftLiveTabState actions (spec/68)', () => {
  it('carries a live action onto a snapshot that predates it (undo keeps the assignment)', () => {
    const live = [tab('t1', [shape('a', action())])];
    const snapshot = [tab('t1', [shape('a')])];
    const restored = graftLiveTabState(live, snapshot);
    expect((restored[0]!.elements[0] as ShapeElement).action).toEqual(action());
  });

  it('drops a snapshot action the live state no longer has (deleted action stays deleted)', () => {
    const live = [tab('t1', [shape('a')])];
    const snapshot = [tab('t1', [shape('a', action())])];
    const restored = graftLiveTabState(live, snapshot);
    expect('action' in restored[0]!.elements[0]!).toBe(false);
  });

  it('carries a completion onto a snapshot taken while the action was open', () => {
    const done = action({ status: 'done', updatedAt: 2 });
    const live = [tab('t1', [shape('a', done)])];
    const snapshot = [tab('t1', [shape('a', action())])];
    const restored = graftLiveTabState(live, snapshot);
    expect((restored[0]!.elements[0] as ShapeElement).action).toEqual(done);
  });

  it('keeps the snapshot action for an element the live state lacks (undone delete restores it)', () => {
    const live = [tab('t1', [shape('other')])];
    const snapshot = [tab('t1', [shape('other'), shape('deleted', action())])];
    const restored = graftLiveTabState(live, snapshot);
    expect((restored[0]!.elements[1] as ShapeElement).action).toEqual(action());
  });

  it('returns the same tab object when nothing changes', () => {
    const shared = shape('a', action());
    const live = [tab('t1', [shared])];
    const snapshot = [tab('t1', [shared])];
    const restored = graftLiveTabState(live, snapshot);
    expect(restored[0]).toBe(snapshot[0]);
  });
});
