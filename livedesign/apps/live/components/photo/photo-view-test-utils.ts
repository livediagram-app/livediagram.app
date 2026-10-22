// A photo page's editor view for component tests: the test harness's session (photo-test-utils.ts) in
// the shape the photo components read, every callback recorded.
import { vi } from 'vitest';
import type { Photo, PhotoLayer } from '@livedesign/photo-engine';
import { OverlayStore, type PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { PhotoHistory } from '@/lib/photo-editor/photo-history';
import { harness, photoOf, pixelLayer, solid } from '@/lib/photo-editor/photo-test-utils';
import type { Raster } from '@livedesign/photo-engine';

export function photoView(
  photo: Photo = photoOf(16, 12, [
    pixelLayer('bg', { name: 'Background' }),
    pixelLayer('a', { name: 'Layer 1' }),
  ]),
  pixels: Record<string, Raster> = { bg: solid(photo.width, photo.height, [255, 255, 255, 255]) },
  over: Partial<PhotoEditorView> = {},
) {
  const h = harness(photo, pixels);
  const toasts: string[] = [];
  const view: PhotoEditorView = {
    photos: { p: h.s.photo },
    tabId: 't',
    focusId: 'p',
    session: h.s,
    version: 0,
    canEdit: true,
    canInspect: true,
    ctx: h.ctx,
    overlay: new OverlayStore(),
    history: new PhotoHistory(),
    depth: 0,
    stepHistory: vi.fn(),
    press: vi.fn(),
    textEdit: null,
    endTextEdit: vi.fn(),
    scope: null,
    store: null,
    toast: (m: string) => toasts.push(m),
    writePhoto: vi.fn(),
    runtime: null,
    others: () => [],
    fitPhoto: vi.fn(),
    actualPixels: vi.fn(),
    ...over,
  };
  return { ...h, view, toasts };
}

export const layerNamed = (photo: Photo, name: string): PhotoLayer | undefined =>
  photo.layers.find((l) => l.name === name);
