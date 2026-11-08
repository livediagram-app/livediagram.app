// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-performance.md "A collaborator moving renders what shows them, not the editor": a busy
// room's cursors, flushed once a frame by the presence coalescer, render the cursor layer and never the editor root or
// a component reading its context. Before the peer-motion store, 30 peers moving for 60 frames rendered the root and
// every context reader 60 times; now 0.
import { act, cleanup, render } from '@testing-library/react';
import { createContext, memo, use, useEffect, type Dispatch, type SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import type { Participant } from '@/lib/identity';
import type { PeerRowsSource } from '@/lib/peer-motion';
import { usePeerCursorRows } from '@/hooks/collab/usePeerRows';
import { createPresenceCoalescer, type PresenceCoalescer } from './presence-coalescer';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';

const PEERS = 30;
const FRAMES = 60;

const person = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const SELF = person('me');
const PEOPLE = Array.from({ length: PEERS }, (_, i) => person(`p${i}`));
const TABS = [{ id: 't1', elements: [] } as unknown as Tab];
const ROSTER = [SELF, ...PEOPLE];

const counts = { root: 0, consumer: 0, cursors: 0 };
const seen: { cursorXs: number[]; onTab: number } = { cursorXs: [], onTab: 0 };
// Counted through calls, so the components themselves never write to what lives outside them.
const tally = (key: keyof typeof counts) => {
  counts[key]++;
};
const note = (next: Partial<typeof seen>) => Object.assign(seen, next);
let room: {
  coalescer: PresenceCoalescer;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
} | null = null;

// What the editor root hands its context: a new object every render, as useEditorState's return is.
type Root = { peerRows: PeerRowsSource; participantsByTab: Map<string, Participant[]> };
const RootContext = createContext<Root | null>(null);

// A chrome component reading the root's context (EditorModals, the TabBar): it renders whenever the root does.
const ContextReader = memo(function ContextReader() {
  const root = use(RootContext)!;
  tally('consumer');
  note({ onTab: root.participantsByTab.get('t1')?.length ?? 0 });
  return null;
});

// The cursor layer, subscribed where it draws, as PeerCursors is.
const CursorLayer = memo(function CursorLayer({ peers }: { peers: PeerRowsSource }) {
  const rows = usePeerCursorRows(peers);
  tally('cursors');
  note({ cursorXs: rows.map((row) => row.x) });
  return null;
});
// The canvas host reads the context too, and hands the peers down.
const CanvasHost = memo(function CanvasHost() {
  const { peerRows } = use(RootContext)!;
  return <CursorLayer peers={peerRows} />;
});

function EditorRoot() {
  tally('root');
  const presence = usePresenceState();
  const rows = usePresenceRows({
    projectShareable: true,
    projectTeamId: null,
    activeId: 't1',
    selfParticipant: SELF,
    tabs: TABS,
    livePresence: presence.livePresence,
    liveAgents: presence.liveAgents,
    presenceClock: presence.presenceClock,
    remoteTabFocus: presence.remoteTabFocus,
    remoteSelections: presence.remoteSelections,
    peerMotion: presence.peerMotion,
    cursorsHidden: false,
  });
  const { setRemoteCursors, setLivePresence } = presence;
  // The room connection makes its coalescer from the same setters (useRoomConnection).
  useEffect(() => {
    const coalescer = createPresenceCoalescer({ setRemoteCursors });
    room = { coalescer, setLivePresence };
    return () => coalescer.cancel();
  }, [setRemoteCursors, setLivePresence]);
  return (
    <RootContext value={{ ...presence, ...rows }}>
      <ContextReader />
      <CanvasHost />
    </RootContext>
  );
}

let frame: (() => void) | null = null;
const runFrame = () =>
  act(() => {
    const cb = frame;
    frame = null;
    cb?.();
  });

beforeEach(() => {
  frame = null;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frame = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frame = null;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  room = null;
});

function moveEveryone(frames: number) {
  for (let f = 0; f < frames; f++) {
    for (const [i, p] of PEOPLE.entries()) {
      room!.coalescer.cursor(p.id, { tabId: 't1', x: f, y: i });
    }
    runFrame();
  }
}

describe('peer motion', () => {
  it(`renders neither the root nor its context readers for ${PEERS} peers x ${FRAMES} frames`, () => {
    render(<EditorRoot />);
    act(() => room!.setLivePresence(ROSTER));
    const before = { ...counts };

    moveEveryone(FRAMES);

    expect(counts.root - before.root).toBe(0);
    expect(counts.consumer - before.consumer).toBe(0);
    // The layer that draws them follows every frame, and lands where the peers did.
    expect(counts.cursors - before.cursors).toBe(FRAMES);
    expect(seen.cursorXs).toEqual(Array.from({ length: PEERS }, () => FRAMES - 1));
  });

  it('still updates the lists when someone joins or leaves', () => {
    render(<EditorRoot />);
    act(() => room!.setLivePresence(ROSTER));
    moveEveryone(2);
    expect(seen.onTab).toBe(PEERS + 1);

    const before = { ...counts };
    act(() => room!.setLivePresence(ROSTER.slice(0, -1)));

    // A leave is a roster change: the root and its readers render for it, once.
    expect(counts.root - before.root).toBe(1);
    expect(counts.consumer - before.consumer).toBe(1);
    expect(seen.onTab).toBe(PEERS);
    // The one who left stops being drawn at once.
    expect(seen.cursorXs).toHaveLength(PEERS - 1);
  });
});
