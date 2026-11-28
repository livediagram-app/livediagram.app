'use client';

// The Posters' pictures in 3D (docs/specs/009-elements/poster.md "Performance", 3d-engine.md "A Poster hangs its
// picture"): each poster's chosen picture as a textured quad of its own over its frame's opening (the place its model
// marks, scene-pieces.ts `posterPictures`), cropped to fill it. The frames stay in the pieces' one geometry, so a
// picture loading or changing never rebuilds them. Each picture is read through the same authenticated image read as
// the Image element (apiFetchImageBlobUrl), drawn to a texture at most POSTER_TEXTURE_EDGE px on its longer side, and
// released when its picture changes, its poster goes or the layer closes.

import * as THREE from 'three';

/** The longest side of a poster's texture, in px. */
export const POSTER_TEXTURE_EDGE = 1024;

/** Reads a picture's bytes as a URL to decode, and gives one back once decoded. */
export type PosterPictureLoader = {
  load: (imageId: string, maxEdge: number) => Promise<string | null>;
  release: (url: string) => void;
};

/** A poster's picture place (twelve numbers: four corners) and the gallery id it frames, if any. */
export type PosterPictureEntry = { corners: readonly number[]; imageId: string | null };

export type PosterPictures = {
  object: THREE.Group;
  /** Every poster on the board now: places move, pictures load or go, posters no longer there are released. */
  set: (entries: ReadonlyMap<string, PosterPictureEntry>) => void;
  /** Moves the given posters' pictures only (a drag in progress), leaving every other one as it is. */
  move: (places: ReadonlyMap<string, readonly number[]>) => void;
  /** How many textures are held now (for tests and the perf probe). */
  textures: () => number;
  /** Hides these posters' pictures (their wall is cut down out of the way) and shows every other one again. */
  hide: (ids: ReadonlySet<string>) => void;
  dispose: () => void;
};

/** The texture coordinates that crop a picture `imageAspect` wide per tall to fill a place `placeAspect` (cover). */
export function coverUvs(imageAspect: number, placeAspect: number): Float32Array {
  let u0 = 0;
  let u1 = 1;
  let v0 = 0;
  let v1 = 1;
  if (imageAspect > 0 && placeAspect > 0) {
    if (imageAspect > placeAspect) {
      const keep = placeAspect / imageAspect;
      u0 = (1 - keep) / 2;
      u1 = u0 + keep;
    } else {
      const keep = imageAspect / placeAspect;
      v0 = (1 - keep) / 2;
      v1 = v0 + keep;
    }
  }
  // Bottom left, bottom right, top right, top left (MeshBuilder.picture's order); an image's v runs up.
  return new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]);
}

/** A place's width over its height, from its corners. */
export function placeAspect(c: readonly number[]): number {
  const w = Math.hypot(c[3]! - c[0]!, c[4]! - c[1]!, c[5]! - c[2]!);
  const h = Math.hypot(c[6]! - c[3]!, c[7]! - c[4]!, c[8]! - c[5]!);
  return h > 0 ? w / h : 1;
}

/** The size to draw a picture `w` by `h` at, no side over `edge`. */
export function boundedSize(w: number, h: number, edge: number): { width: number; height: number } {
  const k = Math.min(1, edge / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

type Held = {
  id: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  imageId: string | null;
  key: string;
  aspect: number;
  /** Bumped on every picture change, so a load that finishes late for an older picture is dropped. */
  ticket: number;
};

// A picture's pixels, drawn to a canvas no larger than `edge` on its longer side.
async function decodeBounded(url: string, edge: number): Promise<HTMLCanvasElement | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const { width, height } = boundedSize(img.naturalWidth, img.naturalHeight, edge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

export function createPosterPictures(
  loader: PosterPictureLoader,
  decode: (url: string, edge: number) => Promise<HTMLCanvasElement | null> = decodeBounded,
): PosterPictures {
  const group = new THREE.Group();
  const held = new Map<string, Held>();
  let disposed = false;
  let hidden: ReadonlySet<string> = new Set();

  const place = (h: Held, corners: readonly number[]) => {
    const key = corners.join(',');
    if (key === h.key) return;
    h.key = key;
    const geo = h.mesh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(corners);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    fit(h);
  };
  const fit = (h: Held) => {
    if (!h.mesh.material.map) return;
    const uv = h.mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const corners = h.mesh.geometry.getAttribute('position').array as Float32Array;
    (uv.array as Float32Array).set(coverUvs(h.aspect, placeAspect(Array.from(corners))));
    uv.needsUpdate = true;
  };
  const dropTexture = (h: Held) => {
    const map = h.mesh.material.map;
    if (map) {
      map.dispose();
      h.mesh.material.map = null;
      h.mesh.material.needsUpdate = true;
    }
    h.mesh.visible = false;
  };
  const show = (h: Held, imageId: string | null) => {
    if (h.imageId === imageId) return;
    h.imageId = imageId;
    h.ticket += 1;
    dropTexture(h);
    if (!imageId) return;
    const ticket = h.ticket;
    void (async () => {
      const url = await loader.load(imageId, POSTER_TEXTURE_EDGE).catch(() => null);
      if (!url) return;
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await decode(url, POSTER_TEXTURE_EDGE);
      } finally {
        loader.release(url);
      }
      // The picture changed, the poster went or the layer closed while it loaded: nothing to show it on.
      if (!canvas || disposed || h.ticket !== ticket || held.get(h.id) !== h) return;
      const tex = new THREE.CanvasTexture(canvas);
      // The renderer draws colours as given (Real3DLayer: no colour management), so the picture's are too.
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      h.aspect = canvas.width / canvas.height;
      h.mesh.material.map = tex;
      h.mesh.material.needsUpdate = true;
      fit(h);
      h.mesh.visible = !hidden.has(h.id);
    })();
  };
  const release = (id: string, h: Held) => {
    h.ticket += 1;
    dropTexture(h);
    h.mesh.geometry.dispose();
    h.mesh.material.dispose();
    group.remove(h.mesh);
    held.delete(id);
  };

  return {
    object: group,
    set(entries) {
      if (disposed) return;
      for (const [id, h] of held) if (!entries.has(id)) release(id, h);
      for (const [id, entry] of entries) {
        let h = held.get(id);
        if (!h) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
          geo.setAttribute('uv', new THREE.BufferAttribute(coverUvs(1, 1), 2));
          geo.setIndex([0, 1, 2, 0, 2, 3]);
          const mat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.visible = false;
          mesh.frustumCulled = false;
          h = { id, mesh, imageId: null, key: '', aspect: 1, ticket: 0 };
          held.set(id, h);
          group.add(mesh);
        }
        place(h, entry.corners);
        show(h, entry.imageId);
      }
    },
    move(places) {
      for (const [id, corners] of places) {
        const h = held.get(id);
        if (h) place(h, corners);
      }
    },
    textures: () => [...held.values()].filter((h) => h.mesh.material.map).length,
    hide(ids) {
      hidden = ids;
      for (const h of held.values()) h.mesh.visible = !!h.mesh.material.map && !ids.has(h.id);
    },
    dispose() {
      disposed = true;
      for (const [id, h] of [...held]) release(id, h);
    },
  };
}
