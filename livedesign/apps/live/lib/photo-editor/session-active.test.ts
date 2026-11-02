import { describe, expect, it, vi } from 'vitest';
import { removeLayers } from '@livedesign/photo-engine';
import { harness, photoOf, pixelLayer } from './photo-test-utils';
import { newLayer } from './layer-ops';

// docs/specs/031-photo/photo-layers.md "The Layers tab": there is always an active layer while the photo has
// layers, and what reads it redraws when it changes.
describe('the active layer', () => {
  it('is the top pixel layer once an unstarted photo starts', () => {
    const h = harness(photoOf(8, 8, []));
    expect(h.s.active).toBeNull();
    h.s.setPhoto(photoOf(8, 8, [pixelLayer('bg'), pixelLayer('top')]));
    expect(h.s.active).toBe('top');
  });

  it('moves on when the active layer is deleted here', () => {
    const h = harness(photoOf(8, 8, [pixelLayer('a'), pixelLayer('b')]));
    h.s.choose('b', 'layer');
    h.s.setChosen(new Set(['a', 'b']));
    h.s.commitStack(removeLayers(h.s.photo, ['b']), 'Delete Layer');
    expect(h.s.active).toBe('a');
    expect([...h.s.chosen]).toEqual(['a']);
    h.s.preview(removeLayers(h.s.photo, ['a']));
    expect(h.s.active).toBeNull();
  });

  it('redraws what reads it when an op sets it after its commit', () => {
    const h = harness(photoOf(8, 8, [pixelLayer('a')]));
    const seen = vi.fn();
    h.s.subscribe(seen);
    newLayer(h.s);
    const calls = seen.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(2);
    const versionAfter = h.s.version;
    const same = h.s.active;
    h.s.active = same;
    expect(h.s.version).toBe(versionAfter);
  });
});

// docs/specs/031-photo/photo-adjustments.md "Performance": what changes no pixel names no tile, so the screen
// keeps every tile it has uploaded (null would have it upload the whole photo again).
describe('a redraw that changes no pixels', () => {
  it('names no tiles for the active layer, the chosen, the solo, a stack edit or the photo coming back', () => {
    const h = harness(photoOf(8, 8, [pixelLayer('a'), pixelLayer('b')]));
    const seen = vi.fn<(changes: readonly unknown[] | null) => void>();
    h.s.subscribe(seen);
    h.s.choose('a', 'layer');
    h.s.setChosen(new Set(['a', 'b']));
    h.s.setSolo('a');
    h.s.preview({ ...h.s.photo });
    // A stack edit and the photo coming back: sync names any tiles it changed itself.
    h.s.commitStack({ ...h.s.photo }, 'Opacity');
    h.s.setPhoto({ ...h.s.photo });
    // (A tile load the harness started may land first, naming everything.)
    expect(seen.mock.calls.map((c) => c[0]).slice(-6)).toEqual([[], [], [], [], [], []]);
  });
});
