import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { capBandBaselineY } from '@liveworkspace/icons';
import { Avatar as CanvasAvatar } from './feature-art/canvas-parts';
import { Avatar as ModeAvatar } from './feature-art/mode-parts';
import { TogetherBoard } from './hero-together-board';

// The collaboration art's initials discs centre their letters' cap band, not a guessed offset
// (docs/specs/004-interface-design/optical-alignment.md "SVG text centres on its cap band too"); the audit read
// the comment thread's "TM" 0.51px low.
const MESSAGE_DISC =
  /<circle cx="([\d.]+)" cy="([\d.]+)" r="9"[^>]*><\/circle><text x="[\d.]+" y="([\d.]+)"[^>]*>(TM|JR|1)<\/text>/g;
const textY = (svg: string) => Number(/<text[^>]* y="([\d.]+)"/.exec(svg)![1]);

describe('the collaboration art’s initials discs', () => {
  it('sets each thread and badge disc’s baseline half a cap height below its centre', () => {
    const svg = renderToStaticMarkup(<TogetherBoard />);
    const discs = [...svg.matchAll(MESSAGE_DISC)];
    expect(discs.map((m) => m[4])).toEqual(['1', 'JR', 'TM']);
    for (const m of discs) {
      const size = m[4] === '1' ? 9 : 7.5;
      expect(Number(m[3])).toBeCloseTo(capBandBaselineY(Number(m[2]), size), 5);
    }
  });

  it('centres the feature art’s avatars the same way, at any size', () => {
    const canvas = renderToStaticMarkup(
      <svg>
        <CanvasAvatar cx={10} cy={20} r={6} color="#10b981" initials="TM" />
      </svg>,
    );
    expect(textY(canvas)).toBeCloseTo(capBandBaselineY(20, 6 * 0.95), 5);
    const mode = renderToStaticMarkup(
      <svg>
        <ModeAvatar x={10} y={30} r={4} colour="#10b981" initials="TM" />
      </svg>,
    );
    expect(textY(mode)).toBeCloseTo(capBandBaselineY(30, 4 * 0.95), 5);
  });
});
