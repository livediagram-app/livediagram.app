import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { capBandBaselineY } from '@liveworkspace/icons';
import { Avatar as CanvasAvatar } from './feature-art/canvas-parts';
import { Avatar as ModeAvatar } from './feature-art/mode-parts';
import { CursorMark } from './hero-cursor';
import { TogetherBoard } from './hero-together-board';

// The feature art's initials discs centre their letters' cap band, not a guessed offset
// (docs/specs/004-interface-design/optical-alignment.md "SVG text centres on its cap band too"); the Sites audit read
// the collaboration page's "TM" disc 0.51px low (the hero's comment thread, after the feature art's Avatars).
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

  it('set the hero thread discs, its badge, its name tag and the cursor badges the same way', () => {
    const svg = renderToStaticMarkup(<TogetherBoard />);
    const disc =
      /<circle cx="[\d.]+" cy="([\d.]+)" r="9"[^>]*><\/circle><text x="[\d.]+" y="([\d.]+)"[^>]*>(TM|JR|1)<\/text>/g;
    const discs = [...svg.matchAll(disc)];
    expect(discs.map((m) => m[3])).toEqual(['1', 'JR', 'TM']);
    for (const m of discs) {
      const size = m[3] === '1' ? 9 : 7.5;
      expect(Number(m[2])).toBeCloseTo(capBandBaselineY(Number(m[1]), size), 5);
    }
    // The picture's name tag: a 12-high tag above the picture.
    const tag =
      /<rect x="[\d.]+" y="([\d.]+)" width="20" height="12"[^>]*><\/rect><text[^>]* y="([\d.]+)"[^>]*>JR<\/text>/.exec(
        svg,
      )!;
    expect(Number(tag[2])).toBeCloseTo(capBandBaselineY(Number(tag[1]) + 6, 7.5), 5);
    for (const badge of ['initials', 'name', 'wide-name'] as const) {
      const cursor = renderToStaticMarkup(
        <svg>
          <CursorMark colour="#ec4899" label="JR" badge={badge} />
        </svg>,
      );
      const [, top, height] = /<rect x="10" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/.exec(
        cursor,
      )!;
      const size = Number(/font-size="([\d.]+)"/.exec(cursor)![1]);
      expect(textY(cursor)).toBeCloseTo(
        capBandBaselineY(Number(top) + Number(height) / 2, size),
        5,
      );
    }
  });
});
