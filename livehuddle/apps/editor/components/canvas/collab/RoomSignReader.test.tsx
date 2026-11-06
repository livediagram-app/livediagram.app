// @vitest-environment jsdom

// The Room Sign's reader (docs/specs/009-elements/screen-and-room-sign.md "The sign's reader"): its header, figures,
// Who's Inside and the footer's Knock and Walk In by state, from the pieces' store.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetMeetingLive,
  setKnocker,
  setMeetingLive,
  setRoomWalker,
  type SignLive,
} from '@/lib/office/meeting-live';
import { insideCount, RoomSignReader, signActions } from './RoomSignReader';

afterEach(() => {
  cleanup();
  act(() => resetMeetingLive());
});

const sign = (over: Partial<SignLive> = {}): SignLive => ({
  roomId: 'r1',
  name: 'Kitchen',
  status: 'free',
  count: 0,
  since: null,
  selfInside: false,
  pod: false,
  people: [],
  ...over,
});

const SAM = { id: 'p1', name: 'Sam Lee', color: '#0ea5e9', self: false };
const YOU = { id: 'self', name: 'Ana Ruiz', color: '#22c55e', self: true };

function open(live: SignLive, can: { knock?: boolean; walk?: boolean } = {}) {
  const knock = vi.fn();
  const walk = vi.fn();
  const onClose = vi.fn();
  act(() => {
    if (can.knock !== false) setKnocker(knock);
    if (can.walk !== false) setRoomWalker(walk);
    setMeetingLive(new Map([['s', live]]));
  });
  render(<RoomSignReader elementId="s" onClose={onClose} />);
  return { knock, walk, onClose };
}

const action = (which: 'walk' | 'knock') =>
  document.querySelector<HTMLButtonElement>(`[data-room-sign-action="${which}"]`);

describe('insideCount', () => {
  it('says Nobody, 1 Person or n People', () => {
    expect(insideCount(0)).toBe('Nobody');
    expect(insideCount(1)).toBe('1 Person');
    expect(insideCount(4)).toBe('4 People');
  });
});

describe('signActions', () => {
  const all = { knock: true, walk: true, knocked: false };
  it('offers Walk In alone on a free room', () => {
    expect(signActions(sign(), all)).toEqual({ knock: 'hidden', walk: 'ready', reason: null });
  });
  it('offers Knock and Walk In on a room in use', () => {
    expect(signActions(sign({ status: 'in-use', count: 2 }), all)).toEqual({
      knock: 'ready',
      walk: 'ready',
      reason: null,
    });
  });
  it('says Knocked for the ten seconds after a knock', () => {
    expect(signActions(sign({ status: 'in-use' }), { ...all, knocked: true })).toMatchObject({
      knock: 'knocked',
      reason: 'You can knock again in a moment',
    });
  });
  it('shuts Walk In at a shut pod, keeping Knock', () => {
    expect(signActions(sign({ status: 'dnd', pod: true }), all)).toEqual({
      knock: 'ready',
      walk: 'unavailable',
      reason: 'Its door is shut',
    });
  });
  it('offers nothing to someone inside, and says why', () => {
    expect(signActions(sign({ status: 'in-use', selfInside: true }), all)).toEqual({
      knock: 'unavailable',
      walk: 'unavailable',
      reason: "You're inside this room",
    });
  });
  it('offers nothing while not walking', () => {
    expect(
      signActions(sign({ status: 'in-use' }), { knock: false, walk: false, knocked: false }),
    ).toEqual({
      knock: 'unavailable',
      walk: 'unavailable',
      reason: 'Walk your character to knock or walk in',
    });
  });
});

describe('RoomSignReader', () => {
  it("titles itself with the room's name, a Free chip and an empty Who's Inside", () => {
    open(sign());
    expect(screen.getByRole('dialog', { name: 'Kitchen' })).toBeTruthy();
    expect(document.querySelector('[data-room-sign-status="free"]')?.textContent).toBe('Free');
    expect(screen.getByText('Nobody')).toBeTruthy();
    expect(screen.getByText('Not in use')).toBeTruthy();
    expect(screen.getByText("Nobody's Inside")).toBeTruthy();
    expect(action('knock')).toBeNull();
  });

  it('walks in from a free room and closes', () => {
    const { walk, onClose } = open(sign());
    fireEvent.click(screen.getByRole('button', { name: 'Walk into Kitchen' }));
    expect(walk).toHaveBeenCalledWith('r1');
    expect(onClose).toHaveBeenCalled();
  });

  it('lists who is inside, you first with a You chip, and knocks', () => {
    const { knock } = open(sign({ status: 'in-use', count: 2, since: Date.now(), people: [SAM] }));
    expect(document.querySelector('[data-room-sign-status="in-use"]')?.textContent).toBe('In Use');
    expect(screen.getByText('2 People')).toBeTruthy();
    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('Sam Lee')).toBeTruthy();
    expect(screen.getByText('SL')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Knock on Kitchen' }));
    expect(knock).toHaveBeenCalledWith('r1');
  });

  it('keeps both actions from someone inside, and says why', () => {
    const { knock, walk } = open(
      sign({ status: 'in-use', count: 2, since: 1, selfInside: true, people: [YOU, SAM] }),
    );
    expect(screen.getByText('You')).toBeTruthy();
    expect(document.querySelector('[data-room-sign-reason]')?.textContent).toBe(
      "You're inside this room",
    );
    for (const which of ['walk', 'knock'] as const) {
      const button = action(which)!;
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
    }
    expect(knock).not.toHaveBeenCalled();
    expect(walk).not.toHaveBeenCalled();
  });

  it('reads Do Not Disturb at a shut pod: Knock, no Walk In, and the door line', () => {
    open(sign({ name: 'Office Pod', status: 'dnd', count: 2, since: 1, pod: true }));
    expect(document.querySelector('[data-room-sign-status="dnd"]')?.textContent).toBe(
      'Do Not Disturb',
    );
    expect(screen.getByText(/door is shut while both seats are taken/)).toBeTruthy();
    expect(action('walk')?.getAttribute('aria-disabled')).toBe('true');
    expect(action('knock')?.getAttribute('aria-disabled')).toBeNull();
  });

  it('says a sign by no room is not beside one, with no actions', () => {
    open(sign({ roomId: null, name: 'No Room' }));
    expect(screen.getByText('Not Beside a Room')).toBeTruthy();
    expect(action('walk')).toBeNull();
    expect(action('knock')).toBeNull();
  });

  it('reads a sign the canvas has not worked out yet as a free room with nothing to press', () => {
    render(<RoomSignReader elementId="unknown" onClose={() => {}} />);
    expect(document.querySelector('[data-room-sign-status="free"]')).toBeTruthy();
    expect(action('walk')?.getAttribute('aria-disabled')).toBe('true');
  });
});
