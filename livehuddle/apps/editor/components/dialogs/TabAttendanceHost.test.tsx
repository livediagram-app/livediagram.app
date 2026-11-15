// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabAttendanceHost } from './TabAttendanceHost';

// The host of a tab's Attendance (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): it hands the dialog
// the room's roster by collab key, so an open dialog follows a rename (Work Tracker 825), and keeps the same map while
// nobody's key, name or colour changed.

const seen: { live: unknown; tabName: string }[] = [];
vi.mock('next/dynamic', () => ({
  default: () => (props: { live: unknown; tabName: string }) => {
    seen.push(props);
    return null;
  },
}));
vi.mock('@/lib/api-client', () => ({ apiListAttendance: vi.fn() }));

const state: { ctx: Record<string, unknown> } = { ctx: {} };
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => state.ctx }));

const ctx = (peers: { key?: string; name: string; color: string }[]) => ({
  imageContext: { ownerId: 'o', documentId: 'd', shareCode: null },
  tabs: [{ id: 't1', name: 'Team Pod' }],
  selfParticipant: { id: 'me', key: 'k-me', name: 'Me', color: '#111' },
  livePresence: peers,
});

beforeEach(() => {
  seen.length = 0;
});

describe('TabAttendanceHost', () => {
  it('passes the roster by collab key, rebuilt only when a name or colour changes', () => {
    state.ctx = ctx([{ key: 'k-ada', name: 'Ada', color: '#0ea5e9' }]);
    const { rerender } = render(<TabAttendanceHost tabId="t1" onClose={vi.fn()} />);
    const first = seen.at(-1)!.live as Map<string, unknown>;
    expect(seen.at(-1)!.tabName).toBe('Team Pod');
    expect([...first]).toEqual([
      ['k-me', { name: 'Me', color: '#111' }],
      ['k-ada', { name: 'Ada', color: '#0ea5e9' }],
    ]);
    // A new roster array with the same people: the same map, so the rows keep their memo.
    state.ctx = ctx([{ key: 'k-ada', name: 'Ada', color: '#0ea5e9' }]);
    rerender(<TabAttendanceHost tabId="t1" onClose={vi.fn()} />);
    expect(seen.at(-1)!.live).toBe(first);
    state.ctx = ctx([{ key: 'k-ada', name: 'Ada King', color: '#0ea5e9' }]);
    rerender(<TabAttendanceHost tabId="t1" onClose={vi.fn()} />);
    expect((seen.at(-1)!.live as Map<string, unknown>).get('k-ada')).toEqual({
      name: 'Ada King',
      color: '#0ea5e9',
    });
  });

  it('draws nothing when no tab is asked for or the tab is gone', () => {
    state.ctx = ctx([]);
    render(<TabAttendanceHost tabId={null} onClose={vi.fn()} />);
    render(<TabAttendanceHost tabId="gone" onClose={vi.fn()} />);
    expect(seen).toEqual([]);
  });
});
