// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-performance.md "A collaborator moving renders what shows them, not the editor": a busy
// room's cursors and characters, flushed once a frame by the presence coalescer, render the cursor layer and the
// avatar layer and never the editor root or a component reading its context. Before the peer-motion store, 30 peers
// moving for 60 frames rendered the root and every context reader 60 times; now 0. Half the room walks (a character
// and no cursor drawn, avatar-mode.md "Cursors while walking") and half builds (a cursor only), as a busy Space does.
import { act, cleanup, render } from '@testing-library/react';
import { createContext, memo, use, useEffect, type Dispatch, type SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvatarPacket } from '@livehuddle/api-schema';
import type { Tab } from '@livehuddle/document';
import type { Participant } from '@/lib/identity';
import type { PeerRowsSource } from '@/lib/peer-motion';
import { usePeerAvatarRows, usePeerCursorRows } from '@/hooks/collab/usePeerRows';
import { createPresenceCoalescer, type PresenceCoalescer } from './presence-coalescer';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';

const PEERS = 30;
const FRAMES = 60;

const person = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const SELF = person('me');
const PEOPLE = Array.from({ length: PEERS }, (_, i) => person(`p${i}`));
// The first half walk, the rest are Editors building: their cursors are the ones drawn.
const WALKERS = PEERS / 2;
const BUILDERS = PEERS - WALKERS;
const TABS = [{ id: 't1', elements: [] } as unknown as Tab];
const ROSTER = [SELF, ...PEOPLE];

const counts = { root: 0, consumer: 0, cursors: 0, avatars: 0 };
const seen: { cursorXs: number[]; avatarIds: string[]; onTab: number } = {
  cursorXs: [],
  avatarIds: [],
  onTab: 0,
};
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

// The cursor layer and the avatar layer, subscribed where they draw, as PeerCursors and the canvas are.
const CursorLayer = memo(function CursorLayer({ peers }: { peers: PeerRowsSource }) {
  const rows = usePeerCursorRows(peers);
  tally('cursors');
  note({ cursorXs: rows.map((row) => row.x) });
  return null;
});
const AvatarLayer = memo(function AvatarLayer({ peers }: { peers: PeerRowsSource }) {
  const rows = usePeerAvatarRows(peers);
  tally('avatars');
  note({ avatarIds: rows.map((row) => row.id) });
  return null;
});
// The canvas host reads the context too, and hands the peers down.
const CanvasHost = memo(function CanvasHost() {
  const { peerRows } = use(RootContext)!;
  return (
    <>
      <CursorLayer peers={peerRows} />
      <AvatarLayer peers={peerRows} />
    </>
  );
});

function EditorRoot() {
  tally('root');
  const presence = usePresenceState();
  const rows = usePresenceRows({
    documentShareable: true,
    documentTeamId: null,
    activeId: 't1',
    selfParticipant: SELF,
    tabs: TABS,
    livePresence: presence.livePresence,
    liveAgents: presence.liveAgents,
    presenceClock: presence.presenceClock,
    remoteTabFocus: presence.remoteTabFocus,
    remoteSelections: presence.remoteSelections,
    peerMotion: presence.peerMotion,
  });
  const { setRemoteCursors, setRemoteAvatars, setLivePresence } = presence;
  // The room connection makes its coalescer from the same setters (useRoomConnection).
  useEffect(() => {
    const coalescer = createPresenceCoalescer({ setRemoteCursors, setRemoteAvatars });
    room = { coalescer, setLivePresence };
    return () => coalescer.cancel();
  }, [setRemoteCursors, setRemoteAvatars, setLivePresence]);
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

const packet = (x: number, y: number) =>
  ({ x, y, facing: 'down', walking: true }) as unknown as AvatarPacket;

function moveEveryone(frames: number) {
  for (let f = 0; f < frames; f++) {
    for (const [i, p] of PEOPLE.entries()) {
      room!.coalescer.cursor(p.id, { tabId: 't1', x: f, y: i });
      if (i < WALKERS) room!.coalescer.avatar(p.id, { tabId: 't1', avatar: packet(f, i) });
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
    // The layers that draw them follow every frame, and land where the peers did.
    expect(counts.cursors - before.cursors).toBe(FRAMES);
    expect(counts.avatars - before.avatars).toBe(FRAMES);
    expect(seen.cursorXs).toEqual(Array.from({ length: BUILDERS }, () => FRAMES - 1));
    expect(seen.avatarIds).toHaveLength(WALKERS);
  });

  it('still updates the lists when someone joins or leaves', () => {
    render(<EditorRoot />);
    act(() => room!.setLivePresence(ROSTER));
    moveEveryone(2);
    expect(seen.onTab).toBe(PEERS + 1);

    const before = { ...counts };
    // The last to join, a builder, leaves.
    act(() => room!.setLivePresence(ROSTER.slice(0, -1)));

    // A leave is a roster change: the root and its readers render for it, once.
    expect(counts.root - before.root).toBe(1);
    expect(counts.consumer - before.consumer).toBe(1);
    expect(seen.onTab).toBe(PEERS);
    // The one who left stops being drawn at once.
    expect(seen.cursorXs).toHaveLength(BUILDERS - 1);
    expect(seen.avatarIds).toHaveLength(WALKERS);
  });
});
