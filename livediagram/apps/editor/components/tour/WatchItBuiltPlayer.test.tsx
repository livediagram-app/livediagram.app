// @vitest-environment jsdom

// Watch It Built's player (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): mounted by the host's
// press, it plays the demo through the replay store with telemetry paused; Your Turn, Escape or a change of tab ends
// it, leaves nothing behind and tells the host.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { replayStore } from '@/lib/replay/replay-store';
import { ADD, CHAPTERS } from '@/lib/replay/topics/diagram-basics';
import { CURRICULUM } from '@/lib/replay/curriculum';
import { WatchItBuiltPlayer } from './WatchItBuiltPlayer';

const telemetry = vi.hoisted(() => {
  const state = { paused: false };
  const sent: string[] = [];
  return {
    state,
    sent,
    track: vi.fn((_c: string, action: string, type: string) => {
      if (!state.paused) sent.push(`${action}·${type}`);
    }),
    pauseTelemetry: vi.fn(() => {
      state.paused = true;
    }),
    resumeTelemetry: vi.fn(() => {
      state.paused = false;
    }),
    trackDuringPause: vi.fn((send: () => void) => {
      const was = state.paused;
      state.paused = false;
      send();
      state.paused = was;
    }),
  };
});
vi.mock('@/lib/telemetry', () => telemetry);

const overlay = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('./ReplayOverlay', () => ({
  ReplayOverlay: (props: Record<string, unknown>) => {
    overlay.props = props;
    return null;
  },
}));
const tourEls = vi.hoisted(() => new Map<string, Element>());
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: (id: string) => tourEls.get(id) ?? null,
  clickTour: () => false,
  waitForSelector: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const onEnded = vi.fn();
const card = CURRICULUM.diagram[0]!;
const closeContextMenu = vi.fn();
const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'diagram' },
    activeTab: { id: 'tab1', elements: [], backgroundColor: '#ffffff' },
    closeContextMenu,
    canvasMainRef: { current: null },
    viewport: { get: () => ({ offset: { x: 0, y: 0 }, zoom: 1 }) },
    ...over,
  };
};

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  telemetry.sent.length = 0;
  telemetry.state.paused = false;
  overlay.props = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  replayStore.reset();
  document.documentElement.removeAttribute('data-replay');
});

const press = (name: 'onToggle' | 'onYourTurn') =>
  act(() => (overlay.props![name] as () => void)());

describe('WatchItBuiltPlayer', () => {
  it('starts as it mounts: pauses telemetry and plays the demo in the replay store', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    expect(closeContextMenu).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('data-replay')).toBe(true);
    expect(replayStore.get().active).toBe(true);
    expect(telemetry.state.paused).toBe(true);
    expect(telemetry.sent).toEqual(['View·TourStepAdd']);
    expect(overlay.props).toMatchObject({ index: 0, playing: true, finished: false });
    // The canvas starts empty: A comes out of the palette.
    expect(replayStore.get().elements).toEqual([]);
  });

  it('ends on Your Turn: the demo and fade go, telemetry resumes, and it counts as completed', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    const yourTurn = overlay.props!.onYourTurn as () => void;
    overlay.props = null;
    act(() => yourTurn());
    expect(replayStore.get()).toEqual({
      active: false,
      elements: [],
      menu: null,
      tab: null,
      prefs: null,
      dock: null,
    });
    expect(document.documentElement.hasAttribute('data-replay')).toBe(false);
    expect(telemetry.state.paused).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourCompleted');
    expect(overlay.props).toBeNull();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends as skipped on Escape', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(replayStore.get().active).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourSkipped');
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends as skipped when the tab changes under it', () => {
    editor();
    const { rerender } = render(
      <WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />,
    );
    editor({ activeTab: { id: 'tab2', elements: [] } });
    rerender(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    expect(replayStore.get().active).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourSkipped');
  });

  it('jumps to a chapter on its press, and pauses and plays on the button', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    act(() => (overlay.props!.onChapter as (i: number) => void)(2));
    expect(overlay.props).toMatchObject({ index: 2, ms: 0, playing: true });
    expect(telemetry.sent).toContain('View·TourStepLabel');
    press('onToggle');
    expect(overlay.props!.playing).toBe(false);
    press('onToggle');
    expect(overlay.props!.playing).toBe(true);
  });

  it('with reduced motion, steps chapter end states on Next and finishes on Done', () => {
    reduced = true;
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    expect(overlay.props).toMatchObject({ index: 0, playing: false, reduced: true });
    for (let i = 1; i < CHAPTERS.length; i++) {
      press('onToggle');
      expect(overlay.props).toMatchObject({ index: i, ms: CHAPTERS[i]!.ms - 1 });
    }
    // The finished diagram, green and labelled, is on the canvas at the last chapter's end.
    const b = replayStore.get().elements.find((e) => e.id === 'wib-b');
    expect(b).toMatchObject({ label: 'Check stock', colorPreset: 'success' });
    press('onToggle');
    expect(replayStore.get().active).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourCompleted');
  });
});

describe('WatchItBuiltPlayer reduce motion', () => {
  it("steps instead of playing under the editor's own Reduce Motion setting", () => {
    document.documentElement.classList.add('reduce-motion');
    try {
      editor();
      render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
      expect(overlay.props).toMatchObject({
        playing: false,
        reduced: true,
        ms: CHAPTERS[0]!.ms - 1,
      });
    } finally {
      document.documentElement.classList.remove('reduce-motion');
    }
  });
});

describe('WatchItBuiltPlayer clock', () => {
  it('plays on its own through the chapters, sending each one, and holds on the finished diagram', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    act(() => {
      vi.advanceTimersByTime(CHAPTERS[0]!.ms + 200);
    });
    expect(overlay.props!.index).toBe(1);
    expect(telemetry.sent).toContain('View·TourStepConnect');
    act(() => {
      vi.advanceTimersByTime(CHAPTERS.reduce((sum, c) => sum + c.ms, 0));
    });
    expect(overlay.props).toMatchObject({
      index: CHAPTERS.length - 1,
      finished: true,
      playing: false,
    });
    expect(replayStore.get().active).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();
    // Replay starts it again from the top.
    press('onToggle');
    expect(overlay.props).toMatchObject({ index: 0, playing: true, finished: false });
  });

  it('holds the carried shape: mid-carry the cursor is its centre, holding, even with the palette gone', () => {
    // The canvas fills a 1440x900 screen at zoom 1, so a canvas point is its screen point.
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
    editor({ canvasMainRef: { current: host } });
    const menu = document.createElement('div');
    const tile = document.createElement('button');
    tile.getBoundingClientRect = () => ({ left: 359, top: 227, width: 73, height: 73 }) as DOMRect;
    menu.append(tile);
    menu.setAttribute('data-tour-id', 'palette-category-menu');
    document.body.append(menu);
    tourEls.set('palette-category-menu', menu);
    try {
      render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
      act(() => {
        vi.advanceTimersByTime(ADD.drag1[0] + 20);
      });
      // The carry starts on the tile.
      const start = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      expect(start.x + start.width / 2).toBeCloseTo(395.5, 0);
      expect(start.y + start.height / 2).toBeCloseTo(263.5, 0);
      // The palette closes during the carry; the cursor stays on the shape all the same.
      tourEls.clear();
      menu.remove();
      act(() => {
        vi.advanceTimersByTime((ADD.drag1[1] - ADD.drag1[0]) / 2);
      });
      const carried = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      expect(overlay.props!.cursor).toEqual({
        x: carried.x + carried.width / 2,
        y: carried.y + carried.height / 2,
        pressing: false,
        holding: true,
      });
    } finally {
      tourEls.clear();
    }
  });

  it('reads the palette tile again while the palette is still settling, until the first carry', () => {
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
    editor({ canvasMainRef: { current: host } });
    // The flyout opens with a scale, so its tile first reads off where it ends.
    let rect = { left: 300, top: 180, width: 60, height: 60 };
    const menu = document.createElement('div');
    const tile = document.createElement('button');
    tile.getBoundingClientRect = () => rect as DOMRect;
    menu.append(tile);
    menu.setAttribute('data-tour-id', 'palette-category-menu');
    document.body.append(menu);
    tourEls.set('palette-category-menu', menu);
    try {
      render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
      act(() => {
        vi.advanceTimersByTime(ADD.open1 + 50);
      });
      rect = { left: 359, top: 227, width: 73, height: 73 };
      // A frame at a time (act draws once at its end), so the player sees the moments before the carry.
      for (let t = ADD.open1 + 50; t < ADD.drag1[0] + 50; t += 100) {
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }
      const start = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      expect(Math.abs(start.x + start.width / 2 - 395.5)).toBeLessThan(12);
    } finally {
      menu.remove();
      tourEls.clear();
    }
  });

  it('never jumps: frame to frame through every chapter, Example moves at most a step', () => {
    editor();
    const shapes = (['wib-a', 'wib-b'] as const).map((id, i) => {
      const el = document.createElement('div');
      el.setAttribute('data-element-id', id);
      el.getBoundingClientRect = () =>
        ({
          left: 600,
          top: 200 + i * 200,
          width: 200,
          height: 56,
          bottom: 256 + i * 200,
        }) as DOMRect;
      document.body.append(el);
      return el;
    });
    const menu = document.createElement('div');
    const tile = document.createElement('button');
    tile.getBoundingClientRect = () => ({ left: 359, top: 227, width: 73, height: 73 }) as DOMRect;
    menu.append(tile);
    tourEls.set('palette-category-menu', menu);
    try {
      render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
      let last = overlay.props!.cursor as { x: number; y: number } | null;
      let worst = 0;
      const total = CHAPTERS.reduce((sum, c) => sum + c.ms, 0);
      for (let t = 0; t < total; t += 16) {
        act(() => {
          vi.advanceTimersByTime(16);
        });
        const now = overlay.props!.cursor as { x: number; y: number } | null;
        if (last && now) worst = Math.max(worst, Math.hypot(now.x - last.x, now.y - last.y));
        last = now;
      }
      // The fastest leg covers about 300 px in under a second: no frame should move it more than ~40 px.
      expect(worst).toBeLessThan(40);
    } finally {
      shapes.forEach((el) => el.remove());
      tourEls.clear();
    }
  });

  it('plays under StrictMode: the dev remount begins again after its teardown', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />, {
      reactStrictMode: true,
    });
    expect(replayStore.get().active).toBe(true);
    expect(document.documentElement.hasAttribute('data-replay')).toBe(true);
    expect(telemetry.state.paused).toBe(true);
  });

  it('leaves nothing behind when it unmounts mid-run', () => {
    editor();
    const { unmount } = render(
      <WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />,
    );
    unmount();
    expect(replayStore.get().active).toBe(false);
    expect(document.documentElement.hasAttribute('data-replay')).toBe(false);
    expect(telemetry.state.paused).toBe(false);
  });

  it('steps chapters on the arrow keys and toggles on Space', () => {
    editor();
    render(<WatchItBuiltPlayer card={card} hasMore={false} onEnded={onEnded} />);
    const key = (k: string) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      });
    key('ArrowRight');
    expect(overlay.props!.index).toBe(1);
    key('ArrowLeft');
    expect(overlay.props!.index).toBe(0);
    key(' ');
    expect(overlay.props!.playing).toBe(false);
    key('a');
    expect(overlay.props!.playing).toBe(false);
  });
});
