// @vitest-environment jsdom

// Watch It Built's player (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): mounted by the host's
// press, it plays the demo through the replay store with telemetry paused; Your Turn, Escape or a change of tab ends
// it, leaves nothing behind and tells the host.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replayStore } from '@/lib/replay/replay-store';
import { CHAPTERS } from '@/lib/replay/watch-it-built-script';
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
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
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
