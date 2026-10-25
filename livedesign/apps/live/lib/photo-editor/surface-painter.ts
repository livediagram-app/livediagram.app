// What draws the photo in focus onto its canvas (docs/specs/031-photo/blueprints/photo-engine.md "The
// GPU compositor"): the part of the sheet on screen, at the screen's resolution, by the GPU where it
// can (the CPU otherwise, throttled), redrawn on the next frame after anything asks. Only the tiles a
// change names are uploaded again.
import { adjustmentForm, soloed, type AdjustmentForm, type Photo } from '@livedesign/photo-engine';
import { ContentCache } from './content-cache';
import { renderCpuView } from './cpu-view';
import { GlCompositor, type ViewRect } from './gl/gl-compositor';
import type { PhotoSession, TileChange } from './session';
import { rasterizeText } from './text-raster';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { photoViewOptions } from './view-options';

// The largest drawing buffer a side, device px (past it the view is drawn smaller and stretched).
export const SURFACE_MAX_SIDE = 4096;
// Screen px a photo px from which the pixel grid shows.
export const PIXEL_GRID_FROM = 8;
// The CPU view's least gap between frames, ms: it composites on this thread.
export const CPU_FRAME_MS = 120;

export type Visible = { css: ViewRect; view: ViewRect; w: number; h: number; perPx: number };

/** The part of the sheet on screen: where the canvas sits on the page (canvas px), the photo px it
 *  shows, its buffer's size and the screen px each photo px takes. */
export function visiblePart(
  sheet: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  },
  screen: { width: number; height: number },
  page: { width: number; height: number },
  photo: { width: number; height: number },
  dpr: number,
): Visible | null {
  const left = Math.max(0, sheet.left);
  const top = Math.max(0, sheet.top);
  const right = Math.min(screen.width, sheet.right);
  const bottom = Math.min(screen.height, sheet.bottom);
  if (right <= left || bottom <= top || sheet.width <= 0 || sheet.height <= 0) return null;
  const fx = (left - sheet.left) / sheet.width;
  const fy = (top - sheet.top) / sheet.height;
  const fw = (right - left) / sheet.width;
  const fh = (bottom - top) / sheet.height;
  const k = Math.min(1, SURFACE_MAX_SIDE / Math.max((right - left) * dpr, (bottom - top) * dpr));
  return {
    css: {
      x: fx * page.width,
      y: fy * page.height,
      width: fw * page.width,
      height: fh * page.height,
    },
    view: {
      x: fx * photo.width,
      y: fy * photo.height,
      width: fw * photo.width,
      height: fh * photo.height,
    },
    w: Math.max(1, Math.round((right - left) * dpr * k)),
    h: Math.max(1, Math.round((bottom - top) * dpr * k)),
    perPx: sheet.width / photo.width,
  };
}

const maskKey = (id: string) => `${id}#mask`;

export class SurfacePainter {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private session: PhotoSession | null = null;
  private page = { width: 1, height: 1 };
  private gl: GlCompositor | null = null;
  private cpu = false;
  private readonly content = new ContentCache();
  private readonly forms = new Map<string, { key: string; form: AdjustmentForm }>();
  private frame = 0;
  private lastCpu = 0;
  private unsubscribe: (() => void) | null = null;

  attach(host: HTMLElement, canvas: HTMLCanvasElement): void {
    this.host = host;
    this.canvas = canvas;
  }

  /** The session and the page's size on the canvas now. */
  update(session: PhotoSession, page: { width: number; height: number }): void {
    this.page = page;
    if (session !== this.session) {
      this.unsubscribe?.();
      this.session = session;
      this.unsubscribe = session.subscribe((changes) => this.changed(changes));
    }
  }

  private changed(changes: TileChange[] | null): void {
    const c = this.gl;
    const s = this.session;
    if (c && s) {
      if (changes)
        for (const ch of changes)
          c.invalidate(ch.target === 'mask' ? maskKey(ch.layerId) : ch.layerId, ch.keys);
      else
        for (const l of s.photo.layers) {
          if (l.layerKind === 'pixel') c.invalidate(l.id, s.raster(l.id).keys());
          if (l.mask) c.invalidate(maskKey(l.id), s.raster(l.id, 'mask').keys());
        }
    }
    this.schedule();
  }

  schedule = (): void => {
    if (!this.frame && typeof requestAnimationFrame !== 'undefined')
      this.frame = requestAnimationFrame(() => this.draw());
  };

  private draw(): void {
    this.frame = 0;
    const { host, canvas, session } = this;
    if (!host || !canvas || !session) return;
    // Alt+press on an eye: that layer alone, for this person.
    const photo: Photo = session.solo
      ? { ...session.photo, layers: soloed(session.photo.layers, session.solo) }
      : session.photo;
    const dpr = window.devicePixelRatio || 1;
    const part = visiblePart(
      host.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      this.page,
      photo,
      dpr,
    );
    if (!part) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = '';
    canvas.style.left = `${part.css.x}px`;
    canvas.style.top = `${part.css.y}px`;
    canvas.style.width = `${part.css.width}px`;
    canvas.style.height = `${part.css.height}px`;
    if (canvas.width !== part.w) canvas.width = part.w;
    if (canvas.height !== part.h) canvas.height = part.h;
    const dark = document.documentElement.classList.contains('dark');
    if (!this.cpu && !this.gl) {
      try {
        this.gl = new GlCompositor(canvas);
      } catch {
        this.cpu = true;
        debugLog('[photo] gl-unavailable: the CPU view draws');
      }
    }
    if (this.gl && !this.gl.lost) {
      const live = new Map<string, AdjustmentForm>();
      for (const l of photo.layers) {
        if (l.layerKind !== 'adjustment') continue;
        const key = JSON.stringify(l.adjustment);
        const had = this.forms.get(l.id);
        const form = had?.key === key ? had.form : adjustmentForm(l.adjustment);
        this.forms.set(l.id, { key, form });
        live.set(l.id, form);
      }
      this.gl.render(photo, session.lookup(), part.view, part.w, part.h, {
        contentOf: (l) => this.content.get(l, photo, session.lookup()),
        forms: live,
        checker: 16 * dpr,
        dark,
        grid: part.perPx >= PIXEL_GRID_FROM && photoViewOptions.get().pixelGrid ? 0.35 : 0,
      });
      return;
    }
    // The CPU view: throttled, as it composites here.
    const now = performance.now();
    if (now - this.lastCpu < CPU_FRAME_MS) {
      this.schedule();
      return;
    }
    this.lastCpu = now;
    renderCpuView(canvas, photo, session.lookup(), part.view, { text: rasterizeText, dark });
  }

  dispose(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.unsubscribe?.();
    this.unsubscribe = null;
    // A mount again (Strict Mode's second run) subscribes afresh.
    this.session = null;
    this.gl?.dispose();
    this.gl = null;
  }
}
