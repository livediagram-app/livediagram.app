import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { capBandBaselineY } from '@liveworkspace/icons';
import { Avatar as CanvasAvatar } from './feature-art/canvas-parts';
import { Avatar as ModeAvatar } from './feature-art/mode-parts';

// The feature art's initials discs centre their letters' cap band, not a guessed offset
// (docs/specs/004-interface-design/optical-alignment.md "SVG text centres on its cap band too"); the Sites audit read
// the collaboration page's "TM" disc 0.51px low.
const textY = (svg: string) => Number(/<text[^>]* y="([\d.]+)"/.exec(svg)![1]);

describe('the feature art’s initials discs', () => {
  it('set each baseline half a cap height below the disc’s centre, at any size', () => {
    const canvas = renderToStaticMarkup(
      <svg>
        <CanvasAvatar cx={10} cy={20} r={5.5} color="#10b981" initials="TM" />
      </svg>,
    );
    expect(textY(canvas)).toBeCloseTo(capBandBaselineY(20, 5.5 * 0.95), 5);
    const mode = renderToStaticMarkup(
      <svg>
        <ModeAvatar x={10} y={30} r={4} colour="#10b981" initials="TM" />
      </svg>,
    );
    expect(textY(mode)).toBeCloseTo(capBandBaselineY(30, 4 * 0.95), 5);
  });
});
