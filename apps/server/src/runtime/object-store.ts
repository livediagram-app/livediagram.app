// The Node `Blob`, not the platform global: @cloudflare/workers-types declares
// its own, and this module is the Node side of the seam.
import { Blob } from 'node:buffer';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { ObjectHttpMetadata, ObjectStore, StoredObject } from '@livediagram/runtime';

// The object store for the self-hosted runtime: a directory, because that is the
// smallest thing that works (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Decisions"). Image bytes and document snapshots live here; an operator who
// already runs S3 points the same interface at it in Phase 4.

type Sidecar = {
  httpMetadata?: ObjectHttpMetadata;
  customMetadata?: Record<string, string>;
};

export function diskObjectStore(root: string): ObjectStore {
  const rootAbs = resolve(root);
  mkdirSync(rootAbs, { recursive: true });

  // Keys come from the application (UUIDs, and \`snapshots/<id>.svg\`), but a key is
  // a path here, so it is checked rather than trusted.
  const pathFor = (key: string): string => {
    if (!key || key.includes('\u0000') || key.startsWith('/') || key.split('/').includes('..')) {
      throw new Error(`unsafe object key: ${key}`);
    }
    const full = resolve(rootAbs, key);
    if (full !== rootAbs && !full.startsWith(rootAbs + sep)) {
      throw new Error(`object key escapes the store: ${key}`);
    }
    return full;
  };

  const sidecarFor = (path: string): string => `${path}.meta.json`;

  const readSidecar = (path: string): Sidecar => {
    try {
      return JSON.parse(readFileSync(sidecarFor(path), 'utf8')) as Sidecar;
    } catch {
      return {};
    }
  };

  const remove = (key: string): void => {
    const path = pathFor(key);
    rmSync(path, { force: true });
    rmSync(sidecarFor(path), { force: true });
  };

  return {
    put: async (key, value, options) => {
      const path = pathFor(key);
      mkdirSync(dirname(path), { recursive: true });
      const bytes = await toBytes(value);
      // Write beside the target and rename: a crash mid-write leaves the old
      // object intact rather than a truncated one.
      const staging = `${path}.tmp`;
      writeFileSync(staging, bytes);
      renameSync(staging, path);
      const sidecar: Sidecar = {};
      if (options?.httpMetadata) sidecar.httpMetadata = options.httpMetadata;
      if (options?.customMetadata) sidecar.customMetadata = options.customMetadata;
      writeFileSync(sidecarFor(path), JSON.stringify(sidecar));
      return { key, size: bytes.byteLength };
    },
    get: async (key) => {
      const path = pathFor(key);
      let bytes: Buffer;
      try {
        bytes = readFileSync(path);
      } catch {
        return null;
      }
      const sidecar = readSidecar(path);
      const stored: StoredObject = {
        // A Response's body is the seam's ReadableStream by construction, which
        // keeps this side free of a cast between the Node and Worker type sets.
        body: new Response(new Uint8Array(bytes)).body,
        size: bytes.byteLength,
        text: async () => new TextDecoder().decode(bytes),
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      };
      if (sidecar.httpMetadata) stored.httpMetadata = sidecar.httpMetadata;
      if (sidecar.customMetadata) stored.customMetadata = sidecar.customMetadata;
      return stored;
    },
    delete: async (key) => {
      for (const one of Array.isArray(key) ? key : [key]) remove(one);
    },
  };
}

async function toBytes(value: unknown): Promise<Buffer> {
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (value instanceof Blob) return Buffer.from(await value.arrayBuffer());
  // A stream: read it whole. Objects here are images and SVGs, both bounded by
  // the upload caps the api enforces before bytes reach the store.
  const response = new Response(value as BodyInit);
  return Buffer.from(await response.arrayBuffer());
}
