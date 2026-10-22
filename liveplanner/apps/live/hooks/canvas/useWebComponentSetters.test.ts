// @vitest-environment jsdom

// The web components' writes (docs/specs/009-elements/web-components-and-no-groups.md): the canvas addresses one element by
// id, the menu addresses the selection, and every write is bounded.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createComponent,
  createImage,
  HERO_DEFAULT_CAPTION,
  PROCESS_MAX_STEPS,
  type Element,
  type ImageElement,
  type ShapeElement,
} from '@liveplanner/project';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: Parameters<typeof track>) => track(...a),
  titleCaseType: (s: string) => s,
}));

import { useWebComponentSetters } from './useWebComponentSetters';

const colors = { accent: '#000', surface: '#fff', ink: '#111' };

function harness(elements: Element[], selection: string[] = []) {
  let current = elements;
  const commit = (map: (els: Element[]) => Element[]) => {
    current = map(current);
  };
  const { result } = renderHook(() =>
    useWebComponentSetters({
      currentSelectionIds: () => new Set(selection),
      commit,
      elements: () => current,
    }),
  );
  return { setters: result.current, get: (id: string) => current.find((e) => e.id === id) };
}

describe('useWebComponentSetters (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  const stat = () => createComponent('stat', 0, 0, colors) as ShapeElement;
  const process = () => createComponent('process', 0, 0, colors) as ShapeElement;

  it('setWebRows writes one element by id, bounded', () => {
    const a = stat();
    const b = stat();
    const h = harness([a, b]);
    h.setters.setWebRows(a.id, { stats: [{ value: ' 7 ', caption: 'Days' }] });
    expect((h.get(a.id) as ShapeElement).stats).toEqual([{ value: '7', caption: 'Days' }]);
    expect((h.get(b.id) as ShapeElement).stats).toEqual(b.stats);
  });

  it('appendWebRowTo adds a row until the cap', () => {
    const p = process();
    const h = harness([p]);
    for (let i = 0; i < PROCESS_MAX_STEPS + 3; i++) h.setters.appendWebRowTo(p.id);
    expect((h.get(p.id) as ShapeElement).processSteps).toHaveLength(PROCESS_MAX_STEPS);
  });

  it('appendWebRowTo reports a row it adds even when the commit runs later, and nothing at the cap', () => {
    const p = process();
    const kept: ((els: Element[]) => Element[])[] = [];
    const { result } = renderHook(() =>
      useWebComponentSetters({
        currentSelectionIds: () => new Set(),
        commit: (map) => void kept.push(map),
        elements: () => [p],
      }),
    );
    track.mockClear();
    result.current.appendWebRowTo(p.id);
    expect(kept).toHaveLength(1);
    expect(track).toHaveBeenCalledTimes(1);
    const full = harness([p]);
    for (let i = 0; i < PROCESS_MAX_STEPS + 3; i++) full.setters.appendWebRowTo(p.id);
    track.mockClear();
    full.setters.appendWebRowTo(p.id);
    expect(track).not.toHaveBeenCalled();
  });

  it('setWebRowsSelected lands each field only on its own kind', () => {
    const s = stat();
    const p = process();
    const h = harness([s, p], [s.id, p.id]);
    h.setters.setWebRowsSelected({ processSteps: ['x', 'y'] });
    expect((h.get(p.id) as ShapeElement).processSteps).toEqual(['x', 'y']);
    expect((h.get(s.id) as ShapeElement).processSteps).toBeUndefined();
  });

  it('the Caption Card toggle adds and removes a hero caption on any image', () => {
    const img = createImage(0, 0);
    const h = harness([img], [img.id]);
    h.setters.setHeroCaptionSelected(true);
    expect((h.get(img.id) as ImageElement).heroCaption).toEqual(HERO_DEFAULT_CAPTION);
    h.setters.setHeroCaptionLine(img.id, 'title', '  Launch  day ');
    expect((h.get(img.id) as ImageElement).heroCaption?.title).toBe('Launch day');
    h.setters.setHeroCaptionSelected(false);
    expect('heroCaption' in (h.get(img.id) as ImageElement)).toBe(false);
  });

  it('a caption line on an image without a card is ignored', () => {
    const img = createImage(0, 0);
    const h = harness([img]);
    h.setters.setHeroCaptionLine(img.id, 'title', 'x');
    expect((h.get(img.id) as ImageElement).heroCaption).toBeUndefined();
  });
});
