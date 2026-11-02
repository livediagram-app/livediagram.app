// sharp, for the reader bench: the copy transformers.js already installs (the
// editor does not depend on it), typed by the few calls the bench makes.
import { createRequire } from 'node:module';

type Raw = { width: number; height: number; channels: number };

export type SharpImage = {
  rotate: () => SharpImage;
  removeAlpha: () => SharpImage;
  toColourspace: (space: 'srgb') => SharpImage;
  extract: (region: { left: number; top: number; width: number; height: number }) => SharpImage;
  resize: (width: number, height: number) => SharpImage;
  jpeg: (options: { quality: number }) => SharpImage;
  raw: () => SharpImage;
  toBuffer: {
    (): Promise<Buffer>;
    (options: { resolveWithObject: true }): Promise<{ data: Buffer; info: Raw }>;
  };
};

export const sharp = createRequire(import.meta.resolve('@huggingface/transformers'))('sharp') as (
  input: string | Buffer,
  options?: { raw: Raw },
) => SharpImage;
