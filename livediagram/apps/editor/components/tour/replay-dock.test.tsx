// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDock, dockModel } from '@/components/canvas/whiteboard/dock-test-utils';
import { replayStore } from '@/lib/replay/replay-store';
import { SEARCH } from '@/lib/replay/topics/draw-shapes';
import { OPENABLES, syncOpen, typeInto } from './replay-dom';

// Draw's dock under Watch It Built (docs/specs/007-editor/blueprints/watch-it-built.md "The scope"): the dock shows
// what a frame's `dock` and `prefs.drawPattern` say, and the replay's openables press only the dock's own buttons,
// never one that would pick a tool up or store a setting.

const button = (key: string) =>
  document.querySelector<HTMLElement>(`[data-whiteboard-dock] [data-dock-item="${key}"]`)!;
const flyout = (kind: string) => document.getElementById(`whiteboard-flyout-${kind}`);

afterEach(() => {
  cleanup();
  act(() => replayStore.reset());
});

describe('the dock while a replay runs', () => {
  it('shows the replay marker in hand, its colour and width, and the board it shows', () => {
    renderDock(dockModel('select', { background: 'graph' }));
    expect(button('second').getAttribute('aria-pressed')).toBe('false');
    act(() =>
      replayStore.set({
        active: true,
        dock: {
          tool: 'pen',
          prefs: { activePenId: 'second', recognise: true },
          pens: { second: { colour: 'green', width: 4 } },
        },
        prefs: { drawPattern: 'grid' },
      }),
    );
    expect(button('second').getAttribute('aria-pressed')).toBe('true');
    expect(button('second').getAttribute('aria-label')).toBe('Marker 2, green, thick');
    act(() => OPENABLES['dock-settings']!.toggle());
    const dots = flyout('settings')!.querySelector('button[aria-label="Dots"]')!;
    expect(dots.getAttribute('aria-pressed')).toBe('true');
    const recognise = flyout('settings')!.querySelector('button[aria-label="Shape recognition"]')!;
    expect(recognise.getAttribute('aria-pressed')).toBe('true');
  });

  it('goes back to the person own dock the moment the replay ends', () => {
    renderDock(dockModel('select'));
    act(() => replayStore.set({ active: true, dock: { tool: 'eraser' } }));
    expect(button('eraser').getAttribute('aria-pressed')).toBe('true');
    act(() => replayStore.reset());
    expect(button('eraser').getAttribute('aria-pressed')).toBe('false');
    expect(button('select').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the dock openables', () => {
  it('opens a marker flyout only while the marker shows in hand, never picking it up', () => {
    const { m } = renderDock(dockModel('select'));
    const pen = OPENABLES['dock-pen-second']!;
    act(() => pen.toggle());
    expect(pen.isOpen()).toBe(false);
    expect(m.pickPen).not.toHaveBeenCalled();
    act(() =>
      replayStore.set({ active: true, dock: { tool: 'pen', prefs: { activePenId: 'second' } } }),
    );
    act(() => pen.toggle());
    expect(pen.isOpen()).toBe(true);
    // The real flyout: the colours and the widths.
    expect(flyout('second')!.querySelector('button[aria-label="Thick"]')).not.toBeNull();
    expect(
      flyout('second')!.querySelector('button[data-colour-key][aria-label="Green"]'),
    ).not.toBeNull();
    // The player's teardown closes it by the same press, still in hand.
    const opened = new Set(['dock-pen-second']);
    act(() => syncOpen([], opened));
    expect(pen.isOpen()).toBe(false);
    expect(m.pickPen).not.toHaveBeenCalled();
    expect(m.updatePen).not.toHaveBeenCalled();
  });

  it('opens and closes Shapes and Settings by their buttons, writing nothing', () => {
    const { m } = renderDock(dockModel('select'));
    for (const [id, kind] of [
      ['dock-shapes', 'shapes'],
      ['dock-settings', 'settings'],
    ] as const) {
      const o = OPENABLES[id]!;
      const opened = new Set<string>();
      act(() => syncOpen([id], opened));
      expect(o.isOpen()).toBe(true);
      expect(flyout(kind)).not.toBeNull();
      act(() => syncOpen([], opened));
      expect(o.isOpen()).toBe(false);
    }
    // The Shapes flyout's search, which a topic types into.
    act(() => OPENABLES['dock-shapes']!.toggle());
    // typeInto reads only what is laid out; jsdom lays nothing out.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      right: 10,
      bottom: 10,
    } as DOMRect);
    for (const [query, key] of [
      ['rectangle', 'rectangle'],
      ['sticky', 'sticky'],
    ] as const) {
      act(() => typeInto(SEARCH, query));
      expect(
        document.querySelector(`#whiteboard-flyout-shapes [data-shape-option="${key}"]`),
      ).not.toBeNull();
    }
    rect.mockRestore();
    for (const action of [
      'pickShape',
      'pickSearchedShape',
      'setBackground',
      'setRecognition',
    ] as const)
      expect(m[action]).not.toHaveBeenCalled();
  });

  it('does nothing without a dock on the page', () => {
    for (const id of ['dock-shapes', 'dock-settings', 'dock-pen-second']) {
      expect(OPENABLES[id]!.isOpen()).toBe(false);
      expect(() => OPENABLES[id]!.toggle()).not.toThrow();
    }
  });
});
