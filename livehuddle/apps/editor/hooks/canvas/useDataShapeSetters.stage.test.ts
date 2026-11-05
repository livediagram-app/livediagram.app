import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { useDataShapeSetters } from './useDataShapeSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The setters' inputs over a tab of two stages and a room, with the commits it saw.
function harness(selected: string[]) {
  const tab = {
    els: [
      { ...createShape('stage', 0, 0), id: 'stage' },
      { ...createShape('stage', 0, 400), id: 'other' },
      { ...createShape('room', 600, 0), id: 'room' },
    ] as Element[],
    commits: 0,
  };
  return {
    deps: {
      currentSelectionIds: () => new Set(selected),
      commit: (map: (els: Element[]) => Element[]) => {
        tab.commits++;
        tab.els = map(tab.els);
      },
      elements: () => tab.els,
    },
    byId: (id: string) => tab.els.find((e) => e.id === id)!,
    commits: () => tab.commits,
  };
}

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way in": Who Can Speak and Show Cameras land on
// every selected stage, and nothing else in the selection.
describe('the stage setter', () => {
  it('sets Who Can Speak on the selected stage, leaving a room and an unselected stage as they are', () => {
    vi.mocked(track).mockClear();
    const h = harness(['stage', 'room']);
    useDataShapeSetters(h.deps).setStageSelected({ stageSpeakers: 'take-part' });
    expect(h.byId('stage')).toHaveProperty('stageSpeakers', 'take-part');
    expect(h.byId('other')).not.toHaveProperty('stageSpeakers');
    expect(h.byId('room')).not.toHaveProperty('stageSpeakers');
    expect(h.commits()).toBe(1);
    expect(track).toHaveBeenCalledExactlyOnceWith('Element', 'Changed', 'Stage');
  });

  it('turns Show Cameras on for every selected stage', () => {
    const h = harness(['stage', 'other']);
    useDataShapeSetters(h.deps).setStageSelected({ stageCameras: true });
    expect(h.byId('stage')).toHaveProperty('stageCameras', true);
    expect(h.byId('other')).toHaveProperty('stageCameras', true);
  });

  it('does nothing, and counts nothing, with nothing selected', () => {
    vi.mocked(track).mockClear();
    const h = harness([]);
    useDataShapeSetters(h.deps).setStageSelected({ stageCameras: true });
    expect(h.commits()).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });
});
