// @vitest-environment jsdom

import { act, fireEvent, render } from '@testing-library/react';
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
});

// docs/specs/004-interface-design/tooltips-hover-cards-popovers.md "Touch" (Work Tracker 1236): on a phone, tapping a
// tab pill moves its presence avatars under the finger, and the browser's own mouse move over them is no hover; a
// card that is open closes on a tap anywhere else.
describe('TabPresenceStack on a touch phone', () => {
  const device = { hover: true };
  beforeEach(() => {
    device.hover = true;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(any-hover: hover)' ? device.hover : false;
      },
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  // A tab pill holding the stack, as TabPill draws it.
  function pill() {
    const view = render(
      <div>
        <button type="button">Board</button>
        <TabPresenceStack
          participants={[ada]}
          selfId="me"
          selfRole="edit"
          onOpenCollaborators={vi.fn()}
        />
      </div>,
    );
    const avatarWrap = view.getByRole('img', { name: /Ada/ }).parentElement!;
    const tap = (el: Element) => {
      fireEvent.pointerDown(el, { pointerType: 'touch' });
      fireEvent.pointerUp(el, { pointerType: 'touch' });
      fireEvent.click(el);
    };
    return { view, avatarWrap, tap, card: () => view.queryByRole('tooltip') };
  }

  it('leaves no presence card open after a tab pill is tapped', () => {
    device.hover = false;
    const { view, avatarWrap, tap, card } = pill();
    tap(view.getByRole('button', { name: 'Board' }));
    // Long after the tap, the browser moves its mouse over the avatar now under the finger.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.pointerEnter(avatarWrap, { pointerType: 'mouse' });
    fireEvent.pointerMove(avatarWrap, { pointerType: 'mouse' });
    expect(card()).toBeNull();
  });

  it('closes an open presence card on a tap anywhere else', () => {
    const { view, avatarWrap, tap, card } = pill();
    // A mouse, well clear of any earlier test's touch (a mouse just after one is that touch's echo).
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.pointerEnter(avatarWrap, { pointerType: 'mouse' });
    expect(card()?.textContent).toContain('Ada');
    tap(view.getByRole('button', { name: 'Board' }));
    expect(card()).toBeNull();
  });
});
