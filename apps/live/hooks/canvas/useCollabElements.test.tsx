// @vitest-environment jsdom

// The collaboration elements' room verbs (docs/specs/012-collaboration/roll-call.md,
// docs/specs/012-collaboration/agenda.md), driven through the hook with a fake tab store.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';

import type { Participant } from '@/lib/identity';
import { useCollabElements } from './useCollabElements';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const person = (id: string, key: string, name = id): Participant => ({
  id,
  key,
  name,
  color: '#000000',
  status: 'online',
});

const card = (over: Partial<ShapeElement>): ShapeElement => ({
  id: 'el',
  type: 'shape',
  shape: 'roll-call',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  ...over,
});

function setup(
  element: ShapeElement,
  {
    self = person('owner', 'k-me', 'Me'),
    presence = [] as Participant[],
    startTimer = vi.fn(),
  } = {},
) {
  let tabs: Tab[] = [{ id: 't1', name: 'T', elements: [element] }];
  const tickTabs = (fn: (ts: Tab[]) => Tab[]) => {
    tabs = fn(tabs);
  };
  const { result } = renderHook(() =>
    useCollabElements({
      activeId: 't1',
      commitTabs: tickTabs,
      tickTabs,
      applyElementDelta: vi.fn(),
      activeElements: tabs[0]!.elements,
      editsBlocked: false,
      sessionToolsBlocked: false,
      selfParticipant: self,
      livePresence: presence,
      startTimer,
    }),
  );
  return { api: result.current, el: () => tabs[0]!.elements[0] as ShapeElement };
}

describe('useCollabElements: roll call', () => {
  it('takes one chip per person, by collab key, not one per socket', () => {
    const { api, el } = setup(card({}), {
      presence: [person('socket-2', 'k-me', 'Me again'), person('ada-socket', 'k-ada', 'Ada')],
    });
    api.takeRoll(el());
    expect(el().rollCall?.map((r) => r.name)).toEqual(['Me', 'Ada']);
  });
});
