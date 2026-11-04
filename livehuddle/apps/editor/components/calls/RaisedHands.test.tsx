// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  noteLetSpeak,
  receiveCallOp,
  resetCallPeers,
  resetCallSelf,
  setCallSelf,
} from '@/lib/calls/calls-store';
import { handBadgeAt, RaisedHands } from './RaisedHands';

const peer = (id: string, name: string, x: number) => ({
  id,
  name,
  color: '#f00',
  at: { x, y: 200 },
  scale: 1,
  glideMs: 0,
  walking: false,
});
const peers = [peer('a', 'Sam', 100), peer('b', 'Ana', 300)];
const raise = (id: string, letSpeak?: string) =>
  act(() => receiveCallOp(id, { kind: 'avatar-hand', tabId: 't1', raised: true, letSpeak }));

afterEach(() => {
  cleanup();
  act(() => {
    resetCallPeers();
    resetCallSelf();
  });
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"
describe('RaisedHands', () => {
  it('draws nothing with no hand up', () => {
    const { container } = render(<RaisedHands peers={peers} self={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a hand beside each raised head, a picture for anyone who may not let speak', () => {
    const { container } = render(<RaisedHands peers={peers} self={null} />);
    raise('a');
    expect(screen.getByRole('img', { name: 'Sam raised a hand' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    const placed = container.querySelector<HTMLElement>('[data-raised-hand="a"]')!;
    const at = handBadgeAt({ x: 100, y: 200 }, 1);
    expect(placed.style.left).toBe(`${at.x}px`);
    expect(placed.style.top).toBe(`${at.y}px`);
  });

  it('lets someone who may press Let Speak on a raised hand and Done on a speaking one', () => {
    const onLetSpeak = vi.fn();
    render(<RaisedHands peers={peers} self={null} onLetSpeak={onLetSpeak} />);
    raise('a');
    raise('b', 'ed');
    fireEvent.click(screen.getByRole('button', { name: 'Sam raised a hand, Let Speak' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ana is speaking, Done' }));
    expect(onLetSpeak.mock.calls).toEqual([
      ['a', true],
      ['b', false],
    ]);
    // A hand you let speak reads as speaking at once, before its owner's op comes back.
    act(() => noteLetSpeak('a', true));
    expect(screen.getByRole('button', { name: 'Sam is speaking, Done' })).toBeTruthy();
  });

  it('shows your own hand, raised or speaking', () => {
    render(<RaisedHands peers={[]} self={{ at: { x: 0, y: 0 }, scale: 1 }} />);
    act(() => setCallSelf({ hand: 'raised' }));
    expect(screen.getByRole('img', { name: 'Your hand is raised' })).toBeTruthy();
    act(() => setCallSelf({ hand: 'speaking' }));
    expect(screen.getByRole('img', { name: 'You are speaking' })).toBeTruthy();
  });
});
