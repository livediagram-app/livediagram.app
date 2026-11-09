// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { AvatarPresence } from '@livehuddle/api-schema';
import { createPeerMotion, type PeerAvatar, type PeerRowsSource } from '@/lib/peer-motion';
import type { Participant } from '@/lib/identity';
import { PeopleArrows, arrowPeopleFor } from './PeopleArrows';
import { readPeerAvatarRows } from '@/hooks/collab/usePeerRows';

// docs/specs/008-canvas/people-arrows.md "Who gets an arrow", "Pressing an arrow", "Accessibility"
const person = (id: string, over: Partial<Participant> = {}): Participant => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  color: '#2563eb',
  status: 'online',
  ...over,
});
const SELF = person('me');

function peersWith(people: Participant[], walking: string[], tab = 't1'): PeerRowsSource {
  const motion = createPeerMotion();
  const avatars = new Map<string, PeerAvatar>();
  walking.forEach((id, i) =>
    avatars.set(id, {
      tabId: tab,
      avatar: { x: 5000 + i * 100, y: 300 } as unknown as AvatarPresence,
    }),
  );
  motion.avatars.set(avatars);
  return {
    motion,
    livePresenceById: new Map([SELF, ...people].map((p) => [p.id, p])),
    selfId: SELF.id,
    activeId: 't1',
    tabFocus: new Map(people.map((p) => [p.id, tab])),
  };
}

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone && query.includes('max-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function show(peers: PeerRowsSource) {
  const viewport = createViewportStore(1);
  const utils = render(
    <ViewportStoreProvider store={viewport}>
      <main style={{ position: 'relative' }}>
        <PeopleArrows peers={peers} />
      </main>
    </ViewportStoreProvider>,
  );
  return { ...utils, viewport };
}

describe('who gets an arrow', () => {
  it('gives each walking human on the tab a button named after them', () => {
    const { container } = show(peersWith([person('ada'), person('grace')], ['ada', 'grace']));
    const names = [...container.querySelectorAll('button[data-people-arrow]')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Show Ada', 'Show Grace']);
  });

  it('gives an agent none', () => {
    const peers = peersWith([person('ada'), person('bot', { agent: true })], ['ada', 'bot']);
    expect(arrowPeopleFor(peers, readPeerAvatarRows(peers)).map((p) => p.id)).toEqual(['ada']);
  });

  it('shows none at 10 other people on the tab, walking or not', () => {
    const people = Array.from({ length: 10 }, (_, i) => person(`p${i}`));
    const peers = peersWith(people, ['p0', 'p1']);
    expect(arrowPeopleFor(peers, readPeerAvatarRows(peers))).toEqual([]);
    const nine = peersWith(people.slice(0, 9), ['p0', 'p1']);
    expect(arrowPeopleFor(nine, readPeerAvatarRows(nine))).toHaveLength(2);
  });

  it('counts only people on your tab', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(`p${i}`));
    const peers = peersWith(people, ['p0'], 't2');
    peers.tabFocus = new Map(people.map((p, i) => [p.id, i === 0 ? 't1' : 't2']));
    peers.motion.avatars.set(
      new Map([['p0', { tabId: 't1', avatar: { x: 0, y: 0 } as AvatarPresence }]]),
    );
    expect(arrowPeopleFor(peers, readPeerAvatarRows(peers)).map((p) => p.id)).toEqual(['p0']);
  });

  it('draws nothing on a phone', () => {
    phone = true;
    const { container } = show(peersWith([person('ada')], ['ada']));
    expect(container.querySelector('[data-people-arrows]')).toBeNull();
  });
});

describe('pressing an arrow', () => {
  it('centres the view on that person at the zoom you have', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    const { viewport, container } = show(peersWith([person('ada')], ['ada']));
    act(() => {
      fireEvent.click(container.querySelector('button[data-people-arrow="ada"]')!);
    });
    // jsdom lays nothing out, so the canvas measures 0 by 0: its centre is the origin.
    expect(viewport.get().zoom).toBe(1);
    expect(viewport.get().offset.x).toBe(-5000);
  });
});
