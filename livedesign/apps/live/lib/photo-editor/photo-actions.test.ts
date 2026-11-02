import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMask } from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { track } from '@/lib/telemetry';
import { photoDialogs, lastPhotoFilter } from './photo-dialog-store';
import { openAdjustment, PHOTO_ACTIONS, runPhotoAction } from './photo-actions';
import { harness, photoOf, pixelLayer, solid } from './photo-test-utils';
import { freeTransform, cancelTransform } from './tools/transform-tool';
import { photoViewOptions } from './view-options';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/031-photo/photo-pages.md "The title bar": every photo command, one place, a refusal toasted.
function editor(w = 16, h = 12, layers = [pixelLayer('a'), pixelLayer('b')]) {
  const hs = harness(photoOf(w, h, layers), {
    a: solid(w, h, [200, 100, 50, 255]),
    b: solid(w, h, [0, 0, 0, 0]),
  });
  const toasts: string[] = [];
  const view = {
    session: hs.s,
    ctx: hs.ctx,
    canEdit: true,
    toast: (m: string) => toasts.push(m),
  } as unknown as PhotoEditorView;
  const run = (id: string) => runPhotoAction(id, view);
  return { ...hs, view, toasts, run };
}

const labels = (e: ReturnType<typeof editor>) => e.commits.map((c) => c.label);

beforeEach(() => {
  photoDialogs.close();
  vi.mocked(track).mockClear();
});

describe('the photo menus', () => {
  it('name each command once, with a menu and a section', () => {
    const ids = PHOTO_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of PHOTO_ACTIONS) expect(a.section).toBeGreaterThan(0);
  });

  it('do nothing without a session or for someone who may not edit', () => {
    const e = editor();
    runPhotoAction('new-layer', { ...e.view, canEdit: false });
    runPhotoAction('new-layer', { ...e.view, session: null });
    expect(e.commits).toEqual([]);
  });

  it('open the dialogs by name', () => {
    const e = editor();
    for (const [id, kind] of [
      ['image-size', 'image-size'],
      ['canvas-size', 'canvas-size'],
      ['rotate', 'rotate'],
      ['colour-range', 'colour-range'],
      ['fill', 'fill'],
    ] as const) {
      e.run(id);
      expect(photoDialogs.get()?.kind).toBe(kind);
    }
    openAdjustment('levels');
    expect(photoDialogs.get()).toEqual({ kind: 'adjust', id: 'levels' });
  });

  it('turn and flip the image, each one edit with its event', async () => {
    const e = editor(16, 12);
    e.run('rotate-cw');
    expect([e.s.photo.width, e.s.photo.height]).toEqual([12, 16]);
    e.run('rotate-ccw');
    expect([e.s.photo.width, e.s.photo.height]).toEqual([16, 12]);
    e.run('rotate-180');
    e.run('flip-h');
    e.run('flip-v');
    await e.s.settled();
    expect(e.commits).toHaveLength(5);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PhotoRotated');
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PhotoFlipped');
  });

  it('crops to the selection, and asks for one first', async () => {
    const e = editor();
    e.run('crop-to-selection');
    expect(e.toasts).toEqual(['Make a selection first.']);
    e.s.selection = createMask({ x: 2, y: 2, width: 6, height: 4 }, 255);
    e.run('crop-to-selection');
    await e.s.settled();
    expect([e.s.photo.width, e.s.photo.height]).toEqual([6, 4]);
    e.run('trim');
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PhotoCropped');
  });

  it('runs the Select menu, and the Modify rows ask for a selection first', () => {
    const e = editor();
    e.run('grow');
    expect(e.toasts).toEqual(['Make a selection first.']);
    e.run('select-all');
    expect(e.s.selection).not.toBeNull();
    e.run('inverse');
    e.run('deselect');
    expect(e.s.selection).toBeNull();
    e.run('reselect');
    expect(e.s.selection).not.toBeNull();
    for (const how of ['grow', 'expand', 'contract', 'border', 'smooth', 'feather'] as const) {
      e.run(how);
      expect(photoDialogs.get()).toEqual({ kind: 'modify', how });
    }
  });

  it('runs the Layer menu', async () => {
    const e = editor();
    e.s.choose('b', 'layer');
    e.run('new-layer');
    e.run('new-group');
    e.run('duplicate');
    e.run('group');
    e.run('ungroup');
    e.run('clip');
    e.run('add-mask');
    e.run('toggle-mask');
    e.run('invert-mask');
    e.run('select-mask');
    e.run('apply-mask');
    e.run('delete-mask');
    e.run('select-pixels');
    e.run('merge-down');
    e.run('merge-visible');
    e.run('rasterize');
    e.run('delete-layer');
    await e.s.settled();
    expect(labels(e)).toContain('New Layer');
    expect(labels(e)).toContain('Duplicate Layer');
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PhotoLayerNew');
  });

  it('makes a layer via copy or cut from the selection', async () => {
    const e = editor();
    e.s.choose('a', 'layer');
    e.s.selection = createMask({ x: 0, y: 0, width: 4, height: 4 }, 255);
    const before = e.s.photo.layers.length;
    e.run('duplicate');
    e.s.choose('a', 'layer');
    e.run('layer-via-cut');
    await e.s.settled();
    expect(e.s.photo.layers.length).toBe(before + 2);
  });

  it('flattens at once, or asks first when hidden layers would be lost', async () => {
    const e = editor();
    e.run('flatten');
    await new Promise((r) => setTimeout(r, 0));
    expect(e.s.photo.layers).toHaveLength(1);
    const hidden = editor(8, 8, [pixelLayer('a'), pixelLayer('b', { visible: false })]);
    hidden.run('flatten');
    expect(photoDialogs.get()).toEqual({ kind: 'flatten' });
  });

  it('runs the Edit menu’s fills, clear and clipboard', async () => {
    const e = editor();
    e.s.choose('a', 'layer');
    e.s.selection = createMask({ x: 0, y: 0, width: 4, height: 4 }, 255);
    e.run('fill-foreground');
    e.run('fill-background');
    e.run('clear');
    e.run('copy');
    e.run('copy-merged');
    await new Promise((r) => setTimeout(r, 0));
    e.run('paste');
    e.run('paste-in-place');
    e.run('cut');
    await e.s.settled();
    expect(labels(e)).toEqual(expect.arrayContaining(['Fill', 'Clear']));
  });

  it('clears the selected pixels, or with no selection deletes the layer, and keeps a last one', () => {
    const e = editor();
    e.s.choose('b', 'layer');
    e.run('clear');
    expect(e.s.photo.layers.map((l) => l.id)).toEqual(['a']);
    e.s.choose('a', 'layer');
    e.run('clear');
    expect(e.s.photo.layers.map((l) => l.id)).toEqual(['a']);
    expect(e.toasts).toContain('A photo keeps at least one layer: add another first.');
    expect(PHOTO_ACTIONS.find((a) => a.id === 'fill-background')?.keys).toBe('Mod+Backspace');
  });

  it('says when nothing has been copied from a photo yet', async () => {
    vi.resetModules();
    const fresh = await import('./photo-actions');
    const e = editor();
    fresh.runPhotoAction('paste', e.view);
    expect(e.toasts).toEqual(['Nothing copied from a photo yet.']);
  });

  it('applies Auto Tone, Auto Contrast and Auto Colour as one edit each', async () => {
    const e = editor();
    e.s.choose('a', 'layer');
    e.run('auto-tone');
    e.run('auto-contrast');
    e.run('auto-colour');
    await e.s.settled();
    expect(labels(e)).toEqual(['Auto Tone', 'Auto Contrast', 'Auto Colour']);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PhotoAutoTone');
  });

  it('refuses Auto Tone on a layer that needs rasterizing first', () => {
    const e = editor(8, 8, [
      pixelLayer('a'),
      {
        id: 't',
        name: 'Text',
        layerKind: 'text',
        text: { text: 'Hi', font: 'inter', size: 12, colour: '#000000', x: 0, y: 0 },
      } as never,
    ]);
    e.s.choose('t', 'layer');
    e.run('auto-tone');
    expect(e.toasts).toEqual(['Rasterize the layer to adjust its pixels.']);
  });

  it('repeats the last filter, and says when none was used', async () => {
    const e = editor();
    e.s.choose('a', 'layer');
    e.run('repeat-filter');
    expect(e.toasts).toEqual(['No filter used yet.']);
    lastPhotoFilter.set({ id: 'gaussian-blur', params: { radius: 1 } });
    e.run('repeat-filter');
    await new Promise((r) => setTimeout(r, 30));
    await e.s.settled();
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PhotoFilterGaussianBlur');
  });

  it('starts a Free Transform, and the smart commands report their refusals', async () => {
    const e = editor();
    e.s.choose('a', 'layer');
    e.run('free-transform');
    expect(freeTransform.get()).not.toBeNull();
    cancelTransform(e.ctx);
    e.run('subject');
    e.run('remove-background');
    e.run('content-aware');
    await new Promise((r) => setTimeout(r, 50));
    expect(track).toHaveBeenCalledWith('Element', 'Used', 'PhotoSelectSubject');
    expect(e.toasts.length).toBeGreaterThan(0);
  });
});

describe('several layers chosen together', () => {
  const three = () => {
    const e = editor(8, 8, [pixelLayer('a'), pixelLayer('b'), pixelLayer('c')]);
    e.s.choose('c', 'layer');
    e.s.setChosen(new Set(['a', 'c']));
    return e;
  };
  const ids = (e: ReturnType<typeof editor>) => e.s.photo.layers.map((l) => l.id);

  it('are acted on in stack order with the active one, and let go after', () => {
    const e = three();
    expect(e.s.inHand()).toEqual(['a', 'c']);
    e.run('duplicate');
    expect(e.s.photo.layers).toHaveLength(5);
    expect(e.s.chosen.size).toBe(0);
    expect(e.s.inHand()).toEqual([e.s.active]);
  });

  it('are grouped, or deleted, together', () => {
    const g = three();
    g.run('group');
    const group = g.s.photo.layers.find((l) => l.layerKind === 'group')!;
    expect(g.s.photo.layers.filter((l) => l.parent === group.id).map((l) => l.id)).toEqual([
      'a',
      'c',
    ]);
    const d = three();
    d.run('delete-layer');
    expect(ids(d)).toEqual(['b']);
  });

  it('are merged into one layer at the top-most one’s place by Merge Down', async () => {
    const e = three();
    e.run('merge-down');
    // The merge composites first, then commits.
    await new Promise((r) => setTimeout(r, 0));
    await e.s.settled();
    const left = e.s.photo.layers;
    expect(left).toHaveLength(2);
    expect(left[0]!.id).toBe('b');
    expect(left[1]!.name).toBe('c');
    expect(e.commits.at(-1)?.label).toBe('Merge Layers');
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PhotoLayerMergeLayers');
  });

  it('forget a layer that is gone', () => {
    const e = three();
    e.s.setPhoto({ ...e.s.photo, layers: e.s.photo.layers.filter((l) => l.id !== 'a') });
    expect([...e.s.chosen]).toEqual(['c']);
  });
});

describe('arranging the layers', () => {
  const stack = () => {
    const e = editor(8, 8, [pixelLayer('a'), pixelLayer('b'), pixelLayer('c'), pixelLayer('d')]);
    e.s.choose('b', 'layer');
    return e;
  };
  const ids = (e: ReturnType<typeof editor>) => e.s.photo.layers.map((l) => l.id).join('');

  it('brings forward, sends backward, and to the front and the back', () => {
    const e = stack();
    e.run('bring-forward');
    expect(ids(e)).toBe('acbd');
    e.run('send-backward');
    e.run('send-backward');
    expect(ids(e)).toBe('bacd');
    e.run('send-backward');
    expect(ids(e)).toBe('bacd');
    e.run('bring-to-front');
    expect(ids(e)).toBe('acdb');
    e.run('bring-to-front');
    e.run('send-to-back');
    expect(ids(e)).toBe('bacd');
    expect(e.commits.map((c) => c.label)).toEqual([
      'Bring Forward',
      'Send Backward',
      'Send Backward',
      'Bring to Front',
      'Send to Back',
    ]);
  });

  it('steps the active layer up and down the stack, letting the chosen go', () => {
    const e = stack();
    e.s.setChosen(new Set(['c']));
    e.run('select-layer-above');
    expect(e.s.active).toBe('c');
    expect(e.s.chosen.size).toBe(0);
    e.run('select-layer-above');
    e.run('select-layer-above');
    expect(e.s.active).toBe('d');
    e.run('select-layer-below');
    expect(e.s.active).toBe('c');
  });
});

describe('the view, History and place commands', () => {
  it('fit the photo, show actual pixels, step back and open Place Picture', () => {
    const e = editor();
    const fitPhoto = vi.fn();
    const actualPixels = vi.fn();
    const stepHistory = vi.fn();
    const view = { ...e.view, fitPhoto, actualPixels, stepHistory } as PhotoEditorView;
    runPhotoAction('fit-photo', view);
    runPhotoAction('actual-pixels', view);
    runPhotoAction('step-backward', view);
    expect(fitPhoto).toHaveBeenCalledOnce();
    expect(actualPixels).toHaveBeenCalledOnce();
    expect(stepHistory).toHaveBeenCalledWith(-1);
    runPhotoAction('place-picture', view);
    expect(photoDialogs.get()).toEqual({ kind: 'place' });
  });

  // photo-pages.md "Making sizes" The dialog: refused on an unstarted photo and with no room, and only
  // for someone who may add pages.
  it('opens Make Sizes for an Editor who may add pages, with room, on a started photo', () => {
    const e = editor();
    const addSizes = vi.fn(() => true);
    runPhotoAction('make-sizes', { ...e.view, addSizes, photoRoom: 3 });
    expect(photoDialogs.get()).toEqual({ kind: 'make-sizes' });
    photoDialogs.close();
    runPhotoAction('make-sizes', { ...e.view, addSizes, photoRoom: 0 });
    // No addSizes: a session that may not add pages.
    runPhotoAction('make-sizes', { ...e.view, photoRoom: 3 });
    expect(e.toasts).toEqual([
      'A tab holds up to 10 photo pages. Delete one to make sizes.',
      'A tab holds up to 10 photo pages. Delete one to make sizes.',
    ]);
    const blank = editor(16, 12, []);
    runPhotoAction('make-sizes', { ...blank.view, addSizes, photoRoom: 3 });
    expect(blank.toasts).toEqual(['Start the photo first: there is nothing to make sizes from.']);
    // A Participant or a Viewer runs no photo command at all.
    runPhotoAction('make-sizes', { ...e.view, addSizes, photoRoom: 3, canEdit: false });
    expect(photoDialogs.get()).toBeNull();
  });

  it('toggles the pixel grid for this browser', () => {
    const e = editor();
    const was = photoViewOptions.get().pixelGrid;
    e.run('pixel-grid');
    expect(photoViewOptions.get().pixelGrid).toBe(!was);
    e.run('pixel-grid');
    expect(photoViewOptions.get().pixelGrid).toBe(was);
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'PhotoPixelGrid');
  });
});

describe('Rasterize Effects', () => {
  it('draws a layer’s effects into its pixels, the effects gone, and says when there are none', async () => {
    const e = editor(16, 16, [pixelLayer('a')]);
    e.s.choose('a', 'layer');
    e.run('rasterize-effects');
    expect(e.toasts).toEqual(['This layer has no effects to rasterize.']);
    const block = solid(16, 16, [0, 0, 0, 0]);
    for (let y = 6; y < 10; y++)
      for (let x = 6; x < 10; x++) block.data.set([0, 0, 255, 255], (y * 16 + x) * 4);
    const h = harness(
      photoOf(16, 16, [
        pixelLayer('a', {
          effects: { stroke: { size: 2, colour: '#ff0000', position: 'outside' } },
        }),
      ]),
      { a: block },
    );
    const view = { ...e.view, session: h.s, ctx: h.ctx } as PhotoEditorView;
    h.s.choose('a', 'layer');
    runPhotoAction('rasterize-effects', view);
    await h.s.settled();
    const layer = h.s.photo.layers[0] as { effects?: unknown };
    expect(layer.effects).toBeUndefined();
    expect(h.commits.at(-1)?.label).toBe('Rasterize Effects');
    // The stroke is in the pixels now, around the block.
    expect(h.s.raster('a').sample(5, 8, 0)).toBe(255);
    expect(h.s.raster('a').sample(5, 8, 3)).toBe(255);
  });
});
