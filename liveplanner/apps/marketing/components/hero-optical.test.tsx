import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { capBandBaselineY } from '@liveworkspace/icons';
import { Avatar } from './hero-plan-card';
import { TogetherBoard } from './hero-together-board';

// The hero's initials discs centre their letters' cap band, not a guessed offset (docs/specs/004-interface-design/
// optical-alignment.md "SVG text centres on its cap band too"); the audit read Sam's "SM" 0.59px low.
const DISC =
  /<circle cx="([\d.]+)" cy="([\d.]+)" r="8"[^>]*><\/circle><text x="[\d.]+" y="([\d.]+)"[^>]*>SM<\/text>/;

describe('the hero’s initials discs', () => {
  it('sets each SM disc’s baseline half a cap height below its centre', () => {
    const svg = renderToStaticMarkup(<TogetherBoard />);
    const m = DISC.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![3])).toBeCloseTo(capBandBaselineY(Number(m![2]), 7), 5);
  });

  it('centres a plan card’s avatar the same way, at any size', () => {
    const svg = renderToStaticMarkup(
      <svg>
        <Avatar x={10} y={20} who={{ initials: 'SM', colour: '#10b981' }} r={6} />
      </svg>,
    );
    const y = Number(/<text[^>]* y="([\d.]+)"/.exec(svg)![1]);
    expect(y).toBeCloseTo(capBandBaselineY(20, 6 * 0.9), 5);
  });
});
