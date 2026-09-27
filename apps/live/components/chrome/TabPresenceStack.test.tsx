// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@livediagram/tailwind-config/motion';
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
  it('holds a leaving avatar for its pop-out, then drops it', () => {
    const view = render(<TabPresenceStack participants={[ada, bo]} selfId="me" selfRole="edit" />);
    view.rerender(<TabPresenceStack participants={[ada]} selfId="me" selfRole="edit" />);
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(MOTION_MS.micro - 1));
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelectorAll('.animate-pop-out')).toHaveLength(0);
    expect(view.container.querySelectorAll('.animate-pop-in')).toHaveLength(1);
  });
});
