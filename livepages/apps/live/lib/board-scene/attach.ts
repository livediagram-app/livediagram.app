// A scene's image bytes as the import image pipeline's source
// (docs/specs/020-import-export/import-image-pipeline.md "What goes in").
import type { ImportImageSource } from '@/lib/import-images';
import type { SceneAsset } from './scene';

export function sceneImageSource(asset: SceneAsset | undefined): ImportImageSource | null {
  if (!asset) return null;
  const { source } = asset;
  if (source.kind === 'data-url')
    return source.dataUrl ? { kind: 'data-url', dataUrl: source.dataUrl } : null;
  if (source.bytes.byteLength === 0) return null;
  // A copy into a plain ArrayBuffer: a Blob part must not be a view over shared memory.
  return { kind: 'blob', blob: new Blob([source.bytes.slice()], { type: source.mimeType }) };
}
