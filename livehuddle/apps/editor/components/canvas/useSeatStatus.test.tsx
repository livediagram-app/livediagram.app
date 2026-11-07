// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Your own status, as the avatar package keeps it: a plain state here, so the test sees what is written.
const written: (string | null)[] = [];
vi.mock('@liveworkspace/avatar/hooks/useAvatarStatus', () => ({
  useAvatarStatus: () => {
    const [own, setOwn] = useState<string | null>('meeting');
    return [
      own,
      (next: string | null) => {
        written.push(next);
        setOwn(next);
      },
    ];
  },
}));

import { useSeatStatus } from './useSeatStatus';

// docs/specs/009-elements/workday-pieces.md "Statuses a piece sets".

const elements = [
  { id: 'pod', type: 'shape', shape: 'nap-pod' },
  { id: 'tread', type: 'shape', shape: 'treadmill' },
  { id: 'booth', type: 'shape', shape: 'phone-booth' },
  { id: 'chair', type: 'shape', shape: 'chair' },
];

const mount = (seatedOn: string | null) =>
  renderHook((p: { seatedOn: string | null }) => useSeatStatus(true, p.seatedOn, elements), {
    initialProps: { seatedOn },
  });

describe('the status a seat sets', () => {
  it('shows the piece’s status while you sit, and your own again when you stand, never writing it', () => {
    written.length = 0;
    const view = mount(null);
    expect(view.result.current[0]).toBe('meeting');
    view.rerender({ seatedOn: 'pod' });
    expect(view.result.current[0]).toBe('focus');
    view.rerender({ seatedOn: 'tread' });
    expect(view.result.current[0]).toBe('break');
    view.rerender({ seatedOn: 'booth' });
    expect(view.result.current[0]).toBe('busy');
    view.rerender({ seatedOn: 'chair' });
    expect(view.result.current[0]).toBe('meeting');
    view.rerender({ seatedOn: null });
    expect(view.result.current[0]).toBe('meeting');
    expect(written).toEqual([]);
  });

  it('lets a status you pick while sitting win until you stand, then the next seat sets its own', () => {
    const view = mount('pod');
    expect(view.result.current[0]).toBe('focus');
    act(() => view.result.current[1]('dnd'));
    expect(view.result.current[0]).toBe('dnd');
    view.rerender({ seatedOn: null });
    expect(view.result.current[0]).toBe('dnd');
    view.rerender({ seatedOn: 'booth' });
    expect(view.result.current[0]).toBe('busy');
    // A seat that has gone from the board sets nothing.
    view.rerender({ seatedOn: 'deleted' });
    expect(view.result.current[0]).toBe('dnd');
  });
});
