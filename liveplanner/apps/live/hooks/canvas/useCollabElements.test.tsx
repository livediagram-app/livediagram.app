// @vitest-environment jsdom

// The collaboration elements' room verbs (docs/specs/012-collaboration/participant-responses.md), driven through the
// hook with a fake tab store.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@liveplanner/project';

import type { Participant } from '@/lib/identity';
import { useCollabElements } from './useCollabElements';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const self: Participant = {
  id: 'owner',
  key: 'k-me',
  name: 'Me',
  color: '#000000',
  status: 'online',
};

const card = (over: Partial<ShapeElement>): ShapeElement => ({
  id: 'el',
  type: 'shape',
  shape: 'temperature',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  ...over,
});

function setup(element: ShapeElement, editsBlocked = false) {
  let tabs: Tab[] = [{ id: 't1', name: 'T', elements: [element] }];
  const tickTabs = (fn: (ts: Tab[]) => Tab[]) => {
    tabs = fn(tabs);
  };
  const applyElementDelta = vi.fn();
  const { result } = renderHook(() =>
    useCollabElements({
      activeId: 't1',
      tickTabs,
      applyElementDelta,
      activeElements: tabs[0]!.elements,
      editsBlocked,
      selfParticipant: self,
    }),
  );
  return { api: result.current, applyElementDelta, el: () => tabs[0]!.elements[0] as ShapeElement };
}

describe('useCollabElements: responses', () => {
  it('casts an answer under the collab key, never the owner id', () => {
    const { api, applyElementDelta, el } = setup(card({}));
    api.respond(el(), '4');
    expect(applyElementDelta).toHaveBeenCalledWith(
      'el',
      expect.objectContaining({ kind: 'response', participantId: 'k-me', value: '4' }),
    );
  });

  it('clears every answer into a new round', () => {
    const { api, el } = setup(
      card({ responses: [{ participantId: 'k-me', value: '3', at: 1 }], collabRound: 'r1' }),
    );
    api.clearResponses(el());
    expect(el().responses).toEqual([]);
    expect(el().collabRound).not.toBe('r1');
  });

  it('writes nothing for a viewer who may not', () => {
    const { api, applyElementDelta, el } = setup(card({}), true);
    api.respond(el(), '4');
    api.clearResponses(el());
    expect(applyElementDelta).not.toHaveBeenCalled();
    expect(el().responses).toBeUndefined();
  });
});
