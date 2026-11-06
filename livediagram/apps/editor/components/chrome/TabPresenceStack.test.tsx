// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@liveworkspace/style-guards/motion';
import type { Participant } from '@/lib/identity';
import { TabPresenceStack } from './TabPresenceStack';

const person = (id: string, name: string): Participant => ({
  id,
  name,
  color: '#0ea5e9',
  status: 'online',
});

const ada = person('a', 'Ada');
const bo = person('b', 'Bo');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// A leaving avatar is an exit hold (docs/specs/004-interface-design/motion.md): it stays
// mounted exactly as long as its pop-out runs, the micro motion token.
describe('TabPresenceStack', () => {
  it('lifts an agent over the person beside it, so the overlap never hides its mark', () => {
    const agentRow: Participant = { ...person('x', "Ada's Agent"), agent: true };
    const view = render(
      <TabPresenceStack participants={[ada, agentRow]} selfId="me" selfRole="edit" />,
    );
    const [first, second] = [...view.container.querySelectorAll<HTMLElement>('.animate-pop-in')];
    expect(Number(second!.style.zIndex)).toBeGreaterThan(Number(first!.style.zIndex));
  });

  it('holds a leaving avatar for its pop-out, then drops it', () => {
    const view = render(<TabPresenceStack participants={[ada, bo]} selfId="me" selfRole="edit" />);
    view.rerender(<TabPresenceStack participants={[ada]} selfId="me" selfRole="edit" />);
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(MOTION_MS.micro - 1);
    });
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(0);
    expect(view.container.querySelectorAll('.animate-pop-in')).toHaveLength(1);
  });

  it('pops an arrival in, and keeps a leaver who comes back', () => {
    const view = render(<TabPresenceStack participants={[ada]} selfId="me" selfRole="edit" />);
    view.rerender(<TabPresenceStack participants={[ada, bo]} selfId="me" selfRole="edit" />);
    expect(view.container.querySelectorAll('.animate-pop-in')).toHaveLength(2);
    view.rerender(<TabPresenceStack participants={[ada]} selfId="me" selfRole="edit" />);
    view.rerender(<TabPresenceStack participants={[ada, bo]} selfId="me" selfRole="edit" />);
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.micro);
    });
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(0);
    expect(view.container.querySelectorAll('.animate-pop-in')).toHaveLength(2);
  });

  // docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom": a count on our own avatar only.
  it('shows how many follow us on our own avatar, and nowhere else', () => {
    const me = person('me', 'Me');
    const view = render(
      <TabPresenceStack participants={[me, ada]} selfId="me" selfRole="edit" followerCount={2} />,
    );
    const counts = view.container.querySelectorAll('[aria-label="2 following you"]');
    expect(counts).toHaveLength(1);
    view.rerender(<TabPresenceStack participants={[me, ada]} selfId="me" selfRole="edit" />);
    expect(view.container.querySelector('[aria-label$="following you"]')).toBeNull();
  });

  // docs/specs/004-interface-design/touch-targets.md "A tab's presence avatars": a 16px face is too small to tap, so on
  // a touch screen each face and the +N badge is a 24px-wide button padded to 44px tall, the faces apart.
  it('gives each avatar and the +N badge a touch-sized tap area', () => {
    const open = vi.fn();
    const people = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id, id.toUpperCase()));
    const view = render(
      <TabPresenceStack
        participants={people}
        selfId="me"
        selfRole="edit"
        onOpenCollaborators={open}
      />,
    );
    const buttons = [...view.container.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      expect(b.className).toMatch(/(^|\s)relative(\s|$)/);
      expect(b.className).toContain('touch-target-y');
      expect(b.className).toContain('pointer-coarse:px-1');
    }
    const overlapped = [...view.container.querySelectorAll<HTMLElement>('.-mr-0\\.5')];
    expect(overlapped.length).toBeGreaterThan(0);
    for (const s of overlapped) expect(s.className).toContain('pointer-coarse:mr-0');
    const more = view.getByRole('button', { name: '2 more participants on this tab' });
    more.click();
    expect(open).toHaveBeenCalledWith(null);
  });

  it('leaves the +N badge inert with no Collaborators modal to open', () => {
    const people = ['a', 'b', 'c', 'd'].map((id) => person(id, id.toUpperCase()));
    const view = render(<TabPresenceStack participants={people} selfId="me" selfRole="edit" />);
    expect(view.getByRole('button', { name: '1 more participant on this tab' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
