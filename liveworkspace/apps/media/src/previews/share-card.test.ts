import { describe, expect, it } from 'vitest';
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_MARGIN,
  SHARE_CARD_MAX_UPSCALE,
  SHARE_CARD_WIDTH,
  shareCardFit,
  shareCardSvg,
} from './share-card';

// The share card (liveworkspace/docs/specs/006-media/previews.md, `GET …/share/:code/image.png`): the drawing fitted inside the
// 1200 x 630 card with a 48 px margin, centred, never stretched or cropped, on its own paper.

const drawing = (w: number, h: number, fill = '#f8fafc') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-10 -20 ${w} ${h}">` +
  `<rect x="-10" y="-20" width="${w}" height="${h}" fill="${fill}"/><circle r="5"/></svg>`;

describe('shareCardFit', () => {
  it('fills the width of a wide drawing inside the margins, centred top to bottom', () => {
    const fit = shareCardFit(2208, 400);
    expect(fit.width).toBe(SHARE_CARD_WIDTH - SHARE_CARD_MARGIN * 2);
    expect(fit.x).toBe(SHARE_CARD_MARGIN);
    expect(fit.y).toBe((SHARE_CARD_HEIGHT - fit.height) / 2);
  });

  it('fills the height of a tall drawing inside the margins, centred side to side', () => {
    const fit = shareCardFit(300, 3000);
    expect(fit.height).toBe(SHARE_CARD_HEIGHT - SHARE_CARD_MARGIN * 2);
    expect(fit.y).toBe(SHARE_CARD_MARGIN);
    expect(fit.x).toBeCloseTo((SHARE_CARD_WIDTH - fit.width) / 2, 1);
  });

  it('keeps the aspect ratio: never stretched', () => {
    const fit = shareCardFit(1000, 250);
    expect(fit.width / fit.height).toBeCloseTo(4, 2);
  });

  it('grows a small drawing at most to the upscale cap', () => {
    const fit = shareCardFit(100, 50);
    expect(fit.width).toBe(100 * SHARE_CARD_MAX_UPSCALE);
    expect(fit.height).toBe(50 * SHARE_CARD_MAX_UPSCALE);
    expect(fit.x).toBe((SHARE_CARD_WIDTH - 200) / 2);
  });
});

describe('shareCardSvg', () => {
  it('nests the drawing at its fit with its own viewBox, on a card of the Open Graph size', () => {
    const card = shareCardSvg(drawing(2208, 400))!;
    expect(
      card.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"'),
    ).toBe(true);
    expect(card).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" x="48" y="215" width="1104" height="200" viewBox="-10 -20 2208 400" preserveAspectRatio="xMidYMid meet">',
    );
    // The drawing's body is kept whole, and both roots close.
    expect(card).toContain('<circle r="5"/></svg></svg>');
    expect(card.match(/<svg\b/g)).toHaveLength(2);
  });

  it("paints the card in the drawing's own paper", () => {
    expect(shareCardSvg(drawing(400, 300, '#1e293b'))).toContain(
      '<rect width="1200" height="630" fill="#1e293b"/>',
    );
  });

  it('falls back to white paper when the drawing has none it can fill with', () => {
    for (const fill of ['none', 'transparent', 'url(#grid)']) {
      expect(shareCardSvg(drawing(400, 300, fill))).toContain(
        '<rect width="1200" height="630" fill="#ffffff"/>',
      );
    }
    const bare = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g/></svg>';
    expect(shareCardSvg(bare)).toContain('fill="#ffffff"');
  });

  it('takes a viewBox from the size when the root has none, and skips an XML prolog', () => {
    const card = shareCardSvg('<?xml version="1.0"?>\n<svg width="100" height="50"><g/></svg>')!;
    expect(card).toContain('viewBox="0 0 100 50" preserveAspectRatio');
    expect(card).not.toContain('<?xml');
  });

  it('is null for anything with no sized root to place', () => {
    expect(shareCardSvg('<g/>')).toBeNull();
    expect(shareCardSvg('<svg viewBox="0 0 10 10"/>')).toBeNull();
    expect(shareCardSvg('<svg width="0" height="10"></svg>')).toBeNull();
  });
});
