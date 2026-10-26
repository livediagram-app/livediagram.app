// The share card as a PNG (liveworkspace/docs/specs/006-media/previews.md): link previews draw rasters only, so
// the card's SVG (./share-card.ts) goes through the shared resvg renderer. Its own module because it reaches the
// renderer's wasm, which plain node cannot load: the renderer is imported on first use, so the many suites that load
// the worker's router never reach it, and the route's own tests mock this file.
import { SHARE_CARD_WIDTH, shareCardSvg } from './share-card';

// The PNG of a link's drawing on the card, or null when the drawing has no sized root to place.
export async function shareCardPng(svg: string): Promise<Uint8Array | null> {
  const card = shareCardSvg(svg);
  if (card === null) return null;
  const { workerPngRenderer } = await import('@liveworkspace/render-png/worker');
  // The card is already 1200 x 630; the bound only guards a future card size against a Worker's memory.
  const { png } = await workerPngRenderer.renderPng(card, 1, SHARE_CARD_WIDTH);
  return png;
}
