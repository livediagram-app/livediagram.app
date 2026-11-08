// @vitest-environment jsdom

// Watch It Built's player (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): mounted by the host's
// press, it plays the demo through the replay store with telemetry paused; Your Turn, Escape or a change of tab ends
// it, leaves nothing behind and tells the host.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { replayStore } from '@/lib/replay/replay-store';
import { ADD, CHAPTERS } from '@/lib/replay/watch-it-built-script';
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
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
    expect(closeContextMenu).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute('data-replay')).toBe(true);
    expect(replayStore.get().active).toBe(true);
    expect(telemetry.state.paused).toBe(true);
    expect(telemetry.sent).toEqual(['View·TourStepAdd']);
    expect(overlay.props).toMatchObject({ index: 0, playing: true, finished: false });
    // A waits unseen where it will land, so the host can measure it.
    expect(replayStore.get().elements.map((e) => e.id)).toEqual(['wib-a']);
  });

  it('ends on Your Turn: the demo and fade go, telemetry resumes, and it counts as completed', () => {
    editor();
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
    const yourTurn = overlay.props!.onYourTurn as () => void;
    overlay.props = null;
    act(() => yourTurn());
    expect(replayStore.get()).toEqual({ active: false, elements: [], menu: null });
    expect(document.documentElement.hasAttribute('data-replay')).toBe(false);
    expect(telemetry.state.paused).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourCompleted');
    expect(overlay.props).toBeNull();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends as skipped on Escape', () => {
    editor();
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(replayStore.get().active).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourSkipped');
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends as skipped when the tab changes under it', () => {
    editor();
    const { rerender } = render(<WatchItBuiltPlayer onEnded={onEnded} />);
    editor({ activeTab: { id: 'tab2', elements: [] } });
    rerender(<WatchItBuiltPlayer onEnded={onEnded} />);
    expect(replayStore.get().active).toBe(false);
    expect(telemetry.sent.at(-1)).toBe('Ended·TourSkipped');
  });

  it('jumps to a chapter on its press, and pauses and plays on the button', () => {
    editor();
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
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
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
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
      render(<WatchItBuiltPlayer onEnded={onEnded} />);
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
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
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

  it('holds the carried shape: mid-carry the cursor is its centre, pressed, even with the palette gone', () => {
    editor();
    const a = document.createElement('div');
    a.setAttribute('data-element-id', 'wib-a');
    a.getBoundingClientRect = () => ({ left: 600, top: 200, width: 200, height: 56 }) as DOMRect;
    document.body.append(a);
    const menu = document.createElement('div');
    const tile = document.createElement('button');
    tile.getBoundingClientRect = () => ({ left: 359, top: 227, width: 73, height: 73 }) as DOMRect;
    menu.append(tile);
    tourEls.set('palette-category-menu', menu);
    try {
      render(<WatchItBuiltPlayer onEnded={onEnded} />);
      act(() => {
        vi.advanceTimersByTime(ADD.drag1[0] - 100);
      });
      const landed = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      // The palette closes during the carry; the cursor stays on the shape all the same.
      tourEls.clear();
      act(() => {
        vi.advanceTimersByTime((ADD.drag1[1] - ADD.drag1[0]) / 2 + 100);
      });
      const carried = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      // Settled map: zoom 1, A's landing at (600, 200) on the screen.
      expect(overlay.props!.cursor).toEqual({
        x: 600 + (carried.x - landed.x) + 100,
        y: 200 + (carried.y - landed.y) + 28,
        pressing: true,
      });
    } finally {
      a.remove();
      tourEls.clear();
    }
  });

  it('carries A out from the palette tile even when its first measured frames were still settling', () => {
    editor();
    // A's entrance scales it at first (227x64 for 200x56); one reading then put the tile far off the screen.
    let rect = { left: 606, top: 200, width: 227, height: 64 };
    const a = document.createElement('div');
    a.setAttribute('data-element-id', 'wib-a');
    a.getBoundingClientRect = () => rect as DOMRect;
    const menu = document.createElement('div');
    const tile = document.createElement('button');
    tile.getBoundingClientRect = () => ({ left: 359, top: 227, width: 73, height: 73 }) as DOMRect;
    menu.append(tile);
    tourEls.set('palette-category-menu', menu);
    document.body.append(a);
    try {
      render(<WatchItBuiltPlayer onEnded={onEnded} />);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      rect = { left: 620, top: 204, width: 200, height: 56 };
      act(() => {
        vi.advanceTimersByTime(ADD.drag1[0] - 400);
      });
      const landed = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      act(() => {
        vi.advanceTimersByTime(220);
      });
      const carried = replayStore.get().elements.find((e) => e.id === 'wib-a') as ShapeElement;
      // On the screen (settled map: zoom 1, A's landing at 620) the carried centre starts at the tile's, 395.
      const screenX = 620 + (carried.x - landed.x) + carried.width / 2;
      expect(Math.abs(screenX - 395.5)).toBeLessThan(12);
    } finally {
      a.remove();
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
      render(<WatchItBuiltPlayer onEnded={onEnded} />);
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

  it('leaves nothing behind when it unmounts mid-run', () => {
    editor();
    const { unmount } = render(<WatchItBuiltPlayer onEnded={onEnded} />);
    unmount();
    expect(replayStore.get().active).toBe(false);
    expect(document.documentElement.hasAttribute('data-replay')).toBe(false);
    expect(telemetry.state.paused).toBe(false);
  });

  it('steps chapters on the arrow keys and toggles on Space', () => {
    editor();
    render(<WatchItBuiltPlayer onEnded={onEnded} />);
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
