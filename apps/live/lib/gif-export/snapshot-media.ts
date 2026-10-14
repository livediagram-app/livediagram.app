// Pictures in an animated GIF's page snapshot (docs/specs/020-import-export/blueprints/animated-gif-export.md "The
// snapshot", step 4): an SVG drawn as an image loads nothing, so every picture in the clone becomes a `data:` URL
// of the bitmap the canvas already shows. What cannot be sampled shows still, as in a PNG export: a video its
// poster, a drawn <canvas> its current bitmap, a web embed nothing.

// A see-through 1 x 1 PNG: a picture that cannot be read leaves its place empty rather than stopping the export.
export const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export type ImageInliner = {
  /** The picture at `src` as a `data:` URL (the transparent pixel when it cannot be read). */
  dataUrl(src: string): Promise<string>;
};

/** One per export: a picture repeated across pages is read once. */
export function createImageInliner(fetchImpl: typeof fetch = fetch): ImageInliner {
  const cache = new Map<string, Promise<string>>();
  return {
    dataUrl(src) {
      if (!src || src.startsWith('data:')) return Promise.resolve(src || TRANSPARENT_PIXEL);
      let hit = cache.get(src);
      if (!hit) {
        hit = fetchImpl(src)
          .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
          .then(blobToDataUrl)
          .catch(() => TRANSPARENT_PIXEL);
        cache.set(src, hit);
      }
      return hit;
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const URL_IN_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** Every `url(...)` in a CSS value, swapped for its `data:` URL. */
export async function inlineCssUrls(value: string, images: ImageInliner): Promise<string> {
  const urls = [...value.matchAll(URL_IN_CSS)]
    .map((m) => m[2]!)
    .filter((u) => !u.startsWith('data:'));
  if (urls.length === 0) return value;
  const inlined = new Map(
    await Promise.all(urls.map(async (u) => [u, await images.dataUrl(u)] as const)),
  );
  return value.replace(URL_IN_CSS, (whole, _q: string, u: string) =>
    inlined.has(u) ? `url("${inlined.get(u)}")` : whole,
  );
}

/** Give the clone (`twins`, index for index with `live`) every picture as a `data:` URL. */
export async function inlineMedia(
  live: readonly Element[],
  twins: readonly Element[],
  images: ImageInliner,
  skip: (el: Element) => boolean,
): Promise<void> {
  const work: Promise<void>[] = [];
  for (let i = 0; i < live.length; i += 1) {
    const el = live[i]!;
    const twin = twins[i]!;
    if (skip(el)) continue;
    const style = twin.getAttribute('style');
    if (style && style.includes('url(')) {
      work.push(inlineCssUrls(style, images).then((v) => twin.setAttribute('style', v)));
    }
    const tag = el.localName;
    if (tag === 'img') {
      const img = el as HTMLImageElement;
      twin.removeAttribute('srcset');
      twin.removeAttribute('loading');
      work.push(images.dataUrl(img.currentSrc || img.src).then((u) => twin.setAttribute('src', u)));
    } else if (tag === 'image') {
      const href = el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
      work.push(
        images.dataUrl(href).then((u) => {
          twin.removeAttribute('xlink:href');
          twin.setAttribute('href', u);
        }),
      );
    } else if (tag === 'canvas') {
      replaceWithImage(twin, canvasBitmap(el as HTMLCanvasElement));
    } else if (tag === 'video') {
      const poster = (el as HTMLVideoElement).poster;
      work.push(images.dataUrl(poster).then((u) => replaceWithImage(twin, u)));
    } else if (tag === 'iframe') {
      replaceWithImage(twin, TRANSPARENT_PIXEL);
    }
  }
  await Promise.all(work);
}

function canvasBitmap(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return TRANSPARENT_PIXEL;
  }
}

// An <img> in the node's place, with its box (class, style and size).
function replaceWithImage(twin: Element, src: string): void {
  const img = twin.ownerDocument.createElement('img');
  for (const name of ['class', 'style', 'width', 'height']) {
    const v = twin.getAttribute(name);
    if (v !== null) img.setAttribute(name, v);
  }
  img.setAttribute('src', src);
  img.setAttribute('alt', '');
  twin.replaceWith(img);
}
