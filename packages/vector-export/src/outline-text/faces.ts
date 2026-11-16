// The embedded faces an outliner draws with (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text"): their
// bytes out of the stylesheet's data: URLs, registered with the document while the SVG is laid out so the browser
// sets the text in the very faces the outlines are drawn from, and fontkit, loaded only when text is outlined.
import type { FaceSource } from './font-face-css';
import type { Fontkit } from './outline-font';

export type OutlineDeps = { loadFontkit?: () => Promise<Fontkit> };

export async function defaultFontkit(): Promise<Fontkit> {
  const mod = (await import('#fontkit')) as unknown as Fontkit & { default?: Fontkit };
  return typeof mod.create === 'function' ? mod : mod.default!;
}

/** A data: URL's bytes. */
export function bytesOf(url: string): Uint8Array<ArrayBuffer> {
  const comma = url.indexOf(',');
  const bin = atob(url.slice(comma + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Registers `faces` with the document; the returned function takes them away again. */
export async function registerFaces(faces: readonly FaceSource[]): Promise<() => void> {
  const registered: FontFace[] = [];
  const release = () => {
    for (const face of registered) document.fonts.delete(face);
  };
  try {
    for (const f of faces) {
      const face = new FontFace(f.family, bytesOf(f.url), {
        weight: `${f.weight[0]} ${f.weight[1]}`,
        style: f.style,
        unicodeRange: f.ranges
          .map(([lo, hi]) => `U+${lo.toString(16)}-${hi.toString(16)}`)
          .join(','),
      });
      await face.load();
      document.fonts.add(face);
      registered.push(face);
    }
  } catch (err) {
    release();
    throw err;
  }
  return release;
}
