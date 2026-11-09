import { describe, expect, it, vi } from 'vitest';
import { RaisedHand, stagePlace } from './raised-hand';

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"
describe('your raised hand', () => {
  const make = () => {
    const send = vi.fn();
    return { hand: new RaisedHand(send), send };
  };

  it('goes up once, in the room you raised it in, and down again', () => {
    const { hand, send } = make();
    expect(hand.state(false)).toBe('down');
    expect(hand.raise('hall')).toBe(true);
    expect(hand.raise('hall')).toBe(false);
    expect(hand.up).toBe(true);
    expect(hand.state(false)).toBe('raised');
    hand.lower();
    hand.lower();
    expect(send.mock.calls).toEqual([
      [{ kind: 'avatar-hand', raised: true }],
      [{ kind: 'avatar-hand', raised: false }],
    ]);
  });

  it('is let speak by someone who may, and Done lowers it', () => {
    const { hand, send } = make();
    hand.raise(null);
    hand.letSpeak('ed', true, true);
    hand.letSpeak('ed', true, true);
    expect(hand.letSpeakBy).toEqual({ id: 'ed', key: null });
    expect(hand.state(true)).toBe('speaking');
    // Whoever let you speak no longer may: raised again.
    expect(hand.state(false)).toBe('raised');
    hand.letSpeak('ed', false, true);
    expect(hand.up).toBe(false);
    expect(send.mock.calls.slice(1)).toEqual([
      [{ kind: 'avatar-hand', raised: true, letSpeak: 'ed' }],
      [{ kind: 'avatar-hand', raised: false }],
    ]);
  });

  it('ignores a let-speak from someone who may not, or with no hand up', () => {
    const { hand, send } = make();
    hand.letSpeak('ed', true, true);
    hand.raise('hall');
    hand.letSpeak('floor', true, false);
    expect(hand.letSpeakBy).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends who let it speak with their key, so peers follow the person, and resends it to a newcomer', () => {
    const { hand, send } = make();
    hand.raise(null);
    hand.letSpeak('ed', true, true, 'K-ed');
    expect(hand.letSpeakBy).toEqual({ id: 'ed', key: 'K-ed' });
    hand.resend();
    expect(send.mock.calls.slice(1)).toEqual([
      [{ kind: 'avatar-hand', raised: true, letSpeak: 'ed', letSpeakKey: 'K-ed' }],
      [{ kind: 'avatar-hand', raised: true, letSpeak: 'ed', letSpeakKey: 'K-ed' }],
    ]);
  });

  it('goes down on walking into another room, and is resent to a newcomer while up', () => {
    const { hand, send } = make();
    hand.resend();
    expect(send).not.toHaveBeenCalled();
    hand.raise('hall');
    hand.keepIn('hall');
    hand.resend();
    expect(send).toHaveBeenLastCalledWith({ kind: 'avatar-hand', raised: true, letSpeak: null });
    hand.keepIn(null);
    expect(hand.up).toBe(false);
  });

  it('places you towards the stage', () => {
    const none = new Set<string>();
    const live = { self: false, speakers: new Set(['s']), unseen: none };
    expect(stagePlace({ ...live, self: true }, true)).toBe('speaker');
    expect(stagePlace(live, true)).toBe('audience');
    expect(stagePlace(undefined, true)).toBe('barred');
    expect(stagePlace(undefined, false)).toBe('none');
  });
});
