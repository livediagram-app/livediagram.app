// The typefaces a preview draws in (docs/specs/015-api/mcp-server.md §5 "Fonts"): a Worker has no fonts but the
// embedded Inter, so an element set in Lora or Caveat drew in Inter and an agent could not judge its type. The faces
// a tab uses beyond Inter are read from the Google Fonts stylesheet the editor itself loads (fonts.ts' `google`
// specs), whose answer to a client that is not a browser names TrueType files, which resvg reads. Best effort: a face
// that cannot be fetched in time draws in Inter, as before. Each face is fetched once per isolate and kept in the
// Cache API, so a document's previews fetch nothing after the first.
import { FONTS } from '@liveplanner/document';

// The most faces one preview fetches, and how long it waits for them all.
export const PREVIEW_FONTS_MAX = 4;
export const PREVIEW_FONTS_TIMEOUT_MS = 2500;
// The largest face kept (a variable font with every axis can run past a megabyte).
const FACE_BYTES_MAX = 1_500_000;

// How long a family's fetch may stay under way before a later preview starts its own: a request that answered at its
// timeout can have its outstanding fetch cancelled with it, leaving a promise that never settles.
export const PREVIEW_FONTS_PENDING_MAX_MS = 15_000;

const CSS_URL = 'https://fonts.googleapis.com/css2';

// Inter's italics, asked for as a font id when a drawing sets text in italic: the embedded Inter is upright only, and
// resvg draws an italic it has no face for upright, so a preview could not show it.
export const INTER_ITALIC = 'inter-italic';
const INTER_ITALIC_SPEC = 'Inter:ital,wght@1,400;1,700';
// Each family's faces as they are being fetched or were fetched, with when that started and whether it has settled.
const memory = new Map<string, { faces: Promise<Uint8Array[]>; since: number; settled: boolean }>();

export type Fetcher = (url: string) => Promise<Response>;

// The TrueType files a family spec's stylesheet names (one per weight), in order.
export function faceUrlsOf(css: string): string[] {
  return [...css.matchAll(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g)].map(
    (m) => m[1]!,
  );
}

// A fetch through the Cache API: kept once fetched, so a later preview in any isolate reads it from the edge.
export async function cached(url: string, fetcher: Fetcher): Promise<Response | null> {
  const store = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const hit = await store?.match(url).catch(() => undefined);
  if (hit) return hit;
  const res = await fetcher(url).catch(() => null);
  if (!res?.ok) return null;
  if (store) await store.put(url, res.clone()).catch(() => undefined);
  return res;
}

async function facesOf(google: string, fetcher: Fetcher): Promise<Uint8Array[]> {
  const css = await cached(`${CSS_URL}?family=${google}`, fetcher);
  if (!css) return [];
  const faces = await Promise.all(
    faceUrlsOf(await css.text()).map(async (url) => {
      const res = await cached(url, fetcher);
      const bytes = res ? new Uint8Array(await res.arrayBuffer()) : null;
      return bytes && bytes.byteLength <= FACE_BYTES_MAX ? bytes : null;
    }),
  );
  return faces.flatMap((f) => (f ? [f] : []));
}

// The faces of `fontIds` (the editor's font ids, and INTER_ITALIC) other than Inter, as font files: at most PREVIEW_FONTS_MAX families,
// whatever arrives within PREVIEW_FONTS_TIMEOUT_MS; nothing for an unknown id.
export async function previewFonts(
  fontIds: readonly string[],
  fetcher: Fetcher = (url) => fetch(url),
): Promise<Uint8Array[]> {
  const specs = [...new Set(fontIds)]
    .filter((id) => id !== 'inter')
    .flatMap((id) => {
      if (id === INTER_ITALIC) return [INTER_ITALIC_SPEC];
      const font = FONTS.find((f) => f.id === id);
      return font ? [font.google] : [];
    })
    .slice(0, PREVIEW_FONTS_MAX);
  if (specs.length === 0) return [];
  const all = Promise.all(
    specs.map((spec) => {
      const held = memory.get(spec);
      if (held && (held.settled || Date.now() - held.since < PREVIEW_FONTS_PENDING_MAX_MS))
        return held.faces;
      // A fetch that fails part way (a body cut short) is no faces, never a rejection: one bad answer must not fail
      // every later preview in this face, nor this one.
      const entry = {
        faces: facesOf(spec, fetcher).catch(() => [] as Uint8Array[]),
        since: Date.now(),
        settled: false,
      };
      memory.set(spec, entry);
      // A family that failed is tried again by the next preview, not remembered as having no faces.
      void entry.faces.then((f) => {
        entry.settled = true;
        if (f.length === 0 && memory.get(spec) === entry) memory.delete(spec);
      });
      return entry.faces;
    }),
  ).then((sets) => sets.flat());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<Uint8Array[]>((resolve) => {
    timer = setTimeout(() => {
      console.warn('[preview-fonts] faces late; drawing in Inter', { families: specs.length });
      resolve([]);
    }, PREVIEW_FONTS_TIMEOUT_MS);
  });
  const faces = await Promise.race([all, late]);
  if (timer !== undefined) clearTimeout(timer);
  return faces;
}
