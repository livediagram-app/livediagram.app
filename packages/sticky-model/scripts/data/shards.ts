import { readFileSync, writeFileSync } from 'node:fs';
import type { TileSource } from '../../src/train/tile';

// Synthetic walls stored as shards of fixed-size tiles: RGB bytes then class
// bytes per tile, back to back. Generating a wall costs ~0.1 s of JavaScript,
// which would starve the trainer; reading one back costs nothing.

export type ShardMeta = { size: number; perShard: number; shards: number; firstSeed: number };

export const shardPath = (dir: string, i: number) =>
  `${dir}/shard-${String(i).padStart(4, '0')}.bin`;

export function writeShard(path: string, tiles: readonly TileSource[]): void {
  const parts: Buffer[] = [];
  for (const t of tiles) {
    parts.push(Buffer.from(t.rgb.buffer, t.rgb.byteOffset, t.rgb.byteLength));
    parts.push(Buffer.from(t.classes.buffer, t.classes.byteOffset, t.classes.byteLength));
  }
  writeFileSync(path, Buffer.concat(parts));
}

export function readShard(path: string, size: number): TileSource[] {
  const buf = readFileSync(path);
  const per = size * size * 4;
  const tiles: TileSource[] = [];
  for (let o = 0; o + per <= buf.length; o += per) {
    tiles.push({
      width: size,
      height: size,
      rgb: new Uint8Array(buf.buffer, buf.byteOffset + o, size * size * 3),
      classes: new Uint8Array(buf.buffer, buf.byteOffset + o + size * size * 3, size * size),
    });
  }
  return tiles;
}
