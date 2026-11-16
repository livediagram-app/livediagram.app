// @vitest-environment jsdom
// docs/specs/031-photo/photo-tools.md "Text": with Text in hand, a press on the photo makes a text layer at the
// press with its caret ready, a drag one with a box that wraps at its width, and the keys typed next write the
// text, never a tool shortcut. Driven through the canvas's pointer path (PhotoCanvasOverlays) under StrictMode,
// as the dev server runs it: its double mount once ended the new edit at once and removed the empty layer.
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { LaidOutPage } from '@livedesign/design';
import type { PhotoTextEdit } from '@/hooks/editor/usePhotoEditor';
import { harness, photoOf, pixelLayer } from '@/lib/photo-editor/photo-test-utils';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { PhotoCanvasOverlays } from './PhotoCanvasOverlays';
import { PhotoTextEditor } from './PhotoTextEditor';
import { photoView } from './photo-view-test-utils';
import { usePhotoShortcuts } from './usePhotoShortcuts';

// The page is drawn at the photo's own size, so a client px is a photo px.
const page = {
  id: 'p',
  index: 0,
  orientation: 'landscape',
  kind: 'photo',
  rect: { x: 0, y: 0, width: 200, height: 100 },
} as LaidOutPage;

// jsdom draws nothing: a 2D context that measures a glyph as 5 px and draws as a no-op.
beforeEach(() => {
  const ctx: Record<string | symbol, unknown> = {
    measureText: (t: string) => ({ width: t.length * 5 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
  const fake = new Proxy(ctx, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => ((o[k] = v), true),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake as never);
});

afterEach(() => {
  cleanup();
  photoTools.take(null);
  vi.restoreAllMocks();
});

function mount() {
  photoTools.take('text');
  const h = photoView(photoOf(200, 100, [pixelLayer('bg', { name: 'Background' })]), {});
  const { view } = h;
  function Host() {
    const [textEdit, setTextEdit] = useState<PhotoTextEdit | null>(null);
    h.ctx.editText = (layerId, isNew = false) => setTextEdit({ layerId, isNew });
    // The photo's single-key tool shortcuts, live as on the editor page.
    const photo = { ...view, textEdit, endTextEdit: () => setTextEdit(null) };
    usePhotoShortcuts(photo);
    return <PhotoCanvasOverlays pages={[page]} photo={photo} zoom={1} spaceHeld={false} />;
  }
  const r = render(
    <StrictMode>
      <Host />
    </StrictMode>,
  );
  const layer = r.container.querySelector<HTMLElement>('[data-photo-overlay]')!;
  layer.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
  layer.setPointerCapture = () => {};
  return { h, layer, r };
}

const pointer = { button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };

async function press(layer: HTMLElement, from: [number, number], to = from) {
  await act(async () => {
    fireEvent.pointerDown(layer, { ...pointer, clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(layer, { ...pointer, clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(layer, { ...pointer, clientX: to[0], clientY: to[1] });
  });
  // The edit's deferred end (a microtask) has had its chance to run.
  await act(async () => {
    await Promise.resolve();
  });
}

const textLayers = (h: ReturnType<typeof mount>['h']) =>
  h.s.photo.layers.filter((l) => l.layerKind === 'text');

describe('the photo Text tool through the canvas pointer path', () => {
  it('makes a text layer at a press, the caret in its editor, and writes what is typed', async () => {
    const { h, layer } = mount();
    await press(layer, [40, 30]);
    const [made] = textLayers(h);
    expect(made?.layerKind === 'text' && made.text.at).toEqual({ x: 40, y: 30 });
    expect(made?.layerKind === 'text' && made.text.boxWidth).toBeUndefined();
    const field = document.activeElement as HTMLTextAreaElement;
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('aria-label')).toBe('Text');
    // A tool's letter typed into the field is writing, not a shortcut (B is the Brush).
    fireEvent.keyDown(field, { key: 'b' });
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.change(field, { target: { value: 'Hi b' } });
    expect(photoTools.get().tool).toBe('text');
    const typed = h.s.layer(made!.id);
    expect(typed?.layerKind === 'text' && typed.text.text).toBe('Hi b');
    // Escape ends it, the layer kept under its words.
    fireEvent.keyDown(field, { key: 'Escape' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.s.layer(made!.id)?.name).toBe('Hi b');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('makes a boxed text layer from a drag, wrapping at its width', async () => {
    const { h, layer } = mount();
    await press(layer, [20, 10], [120, 60]);
    const [made] = textLayers(h);
    expect(made?.layerKind === 'text' && made.text.at).toEqual({ x: 20, y: 10 });
    expect(made?.layerKind === 'text' && made.text.boxWidth).toBe(100);
    const field = document.activeElement as HTMLTextAreaElement;
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.style.whiteSpace).toBe('pre-wrap');
  });

  it('removes a new layer left empty as its edit ends', async () => {
    const { h, layer } = mount();
    await press(layer, [40, 30]);
    expect(textLayers(h)).toHaveLength(1);
    const field = document.activeElement as HTMLTextAreaElement;
    fireEvent.blur(field);
    await act(async () => {
      await Promise.resolve();
    });
    expect(textLayers(h)).toHaveLength(0);
  });

  it('ends the edit once its field is gone for good (the page left)', async () => {
    const { h, layer, r } = mount();
    await press(layer, [40, 30]);
    const [made] = textLayers(h);
    fireEvent.change(document.activeElement!, { target: { value: 'Yo' } });
    r.unmount();
    expect(h.s.layer(made!.id)?.name).not.toBe('Yo');
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.s.layer(made!.id)?.name).toBe('Yo');
  });

  it('ends the old edit and begins one on the new session when the field is handed another session', async () => {
    const withText = (text: string) =>
      harness(
        photoOf(200, 100, [
          pixelLayer('bg', { name: 'Background' }),
          {
            id: 't',
            name: text,
            layerKind: 'text',
            text: {
              text,
              font: 'inter',
              size: 10,
              weight: 400,
              colour: '#000000',
              align: 'left',
              at: { x: 1, y: 1 },
            },
          },
        ]),
      );
    const a = withText('Old');
    const b = withText('New');
    const edit = { layerId: 't', isNew: false };
    const props = { edit, page: page.rect, onEnd: () => {} };
    const r = render(
      <StrictMode>
        <PhotoTextEditor session={a.s} {...props} />
      </StrictMode>,
    );
    r.rerender(
      <StrictMode>
        <PhotoTextEditor session={b.s} {...props} />
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    // Typing now writes to the new session's layer, never the old one's.
    fireEvent.change(r.container.querySelector('textarea')!, { target: { value: 'Typed' } });
    const textOf = (s: typeof a.s) => {
      const l = s.layer('t');
      return l?.layerKind === 'text' ? l.text.text : null;
    };
    expect(textOf(b.s)).toBe('Typed');
    expect(textOf(a.s)).toBe('Old');
  });
});
