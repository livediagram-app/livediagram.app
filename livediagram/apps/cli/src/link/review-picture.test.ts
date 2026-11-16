import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from '@livediagram/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { arrow, box, tab } from '../testing/review-fixtures';
import { MARK_STYLES, reviewSvg } from './review-picture';

// A tab drawn for a review (docs/specs/027-repositories/blueprints/link-review.md "Marks", RL47).

const flow = tab('flow', 'Flow', [box('a', 'Cart', 0), box('b', 'Pay', 200), arrow('x', 'a', 'b')]);
const plain = (t = flow) =>
  renderElementsToSvg(t, { resolveIconArt: resolveIconExportArt, resolveStickerArt });

describe('reviewSvg', () => {
  it('is the shared renderer’s picture when nothing is marked', () => {
    expect(reviewSvg(flow, [])).toBe(plain());
  });

  it('outlines each marked element over everything, 6 px out, in its kind’s colour and line', () => {
    const svg = reviewSvg(flow, [
      { id: 'a', kind: 'added' },
      { id: 'b', kind: 'changed' },
      { id: 'x', kind: 'removed' },
    ]);
    expect(svg.startsWith(plain().slice(0, plain().lastIndexOf('</svg>')))).toBe(true);
    expect(svg.endsWith('</g>\n</svg>')).toBe(true);
    expect(svg).toContain(
      `<rect x="-6" y="-6" width="172" height="72" rx="6" fill="none" stroke="${MARK_STYLES.added.stroke}" stroke-width="3"/>`,
    );
    expect(svg).toContain(
      `<rect x="194" y="-6" width="172" height="72" rx="6" fill="none" stroke="#9a6700" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/>`,
    );
    expect(svg).toContain('stroke="#cf222e" stroke-width="3" stroke-dasharray="2 5"');
  });

  it('leaves out a mark on an element no layer shows, or one the tab lacks', () => {
    const layered = tab(
      'flow',
      'Flow',
      [box('a', 'Cart', 0, { layerId: 'l1' }), box('b', 'Pay', 200)],
      {
        layers: [{ id: 'l1', name: 'Hidden', visible: false }],
      },
    );
    expect(
      reviewSvg(layered, [
        { id: 'a', kind: 'added' },
        { id: 'zz', kind: 'changed' },
      ]),
    ).toBe(plain(layered));
  });
});
