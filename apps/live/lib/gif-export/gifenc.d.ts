// gifenc 1.0.3 ships no types: the part of its API the GIF export uses (lib/gif-export/gif-encode-core.ts).
declare module 'gifenc' {
  export type GifPalette = number[][];
  export type GifFormat = 'rgb565' | 'rgb444' | 'rgba4444';
  export type GifEncoderStream = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: GifPalette; delay?: number; repeat?: number; first?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifEncoderStream;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: GifFormat },
  ): GifPalette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifFormat,
  ): Uint8Array;
}
