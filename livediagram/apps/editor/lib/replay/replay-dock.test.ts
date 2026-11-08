import { describe, expect, it } from 'vitest';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import { withReplayDock } from './replay-dock';

// Draw's dock as a topic shows it (docs/specs/007-editor/blueprints/watch-it-built.md "The scope"): drawn over the
// model, for the dock's look only.

const model = {
  tool: 'select',
  prefs: DEFAULT_WHITEBOARD_PREFS,
  activePen: DEFAULT_WHITEBOARD_PREFS.pens[0]!,
  armedShape: 'rectangle',
  background: 'blank',
} as unknown as WhiteboardDockModel;

describe('withReplayDock', () => {
  it('is the model itself while no replay runs, or one runs that shows nothing on the dock', () => {
    const shown = { tool: 'pen' as const };
    expect(withReplayDock(model, { active: false, dock: shown, prefs: null })).toBe(model);
    expect(withReplayDock(model, { active: true, dock: null, prefs: null })).toBe(model);
    expect(
      withReplayDock(model, { active: true, dock: null, prefs: { theme: 'x' } as never }),
    ).toBe(model);
  });

  it('draws in the tool, the marker in hand and one marker changed, keeping the rest', () => {
    const shown = withReplayDock(model, {
      active: true,
      dock: {
        tool: 'pen',
        armedShape: null,
        prefs: { activePenId: 'second' },
        pens: { second: { colour: 'green' } },
      },
      prefs: null,
    });
    expect(shown.tool).toBe('pen');
    expect(shown.armedShape).toBeNull();
    expect(shown.activePen).toEqual({ id: 'second', colour: 'green', width: 1.5 });
    expect(shown.prefs.pens[2]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[2]);
    expect(shown.prefs.recognise).toBe(false);
    expect(shown.background).toBe('blank');
    expect(shown.pickPen).toBe(model.pickPen);
  });

  it('shows the board a frame shows', () => {
    const shown = withReplayDock(model, {
      active: true,
      dock: null,
      prefs: { drawPattern: 'graph' },
    });
    expect(shown.background).toBe('graph');
    expect(shown.tool).toBe('select');
    expect(shown.armedShape).toBe('rectangle');
  });
});
