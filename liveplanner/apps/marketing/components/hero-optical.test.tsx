import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { capBandBaselineY } from '@liveworkspace/icons';
import { HeroKanban } from './HeroKanban';
import { Avatar as CanvasAvatar } from './feature-art/canvas-parts';
import { Avatar as ModeAvatar } from './feature-art/mode-parts';
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

  it('centres the feature art’s avatars the same way', () => {
    const textY = (svg: string) => Number(/<text[^>]* y="([\d.]+)"/.exec(svg)![1]);
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

describe('the kanban wall’s lane counts', () => {
  // The audit read "2/3" 0.52px high: as inline content the pill's own strut stretched its line past the
  // trimmed count. A flex pill holds the count alone, so the count's cap band is the pill's middle.
  it('holds each count as the only item of a flex pill', () => {
    const html = renderToStaticMarkup(<HeroKanban />);
    const pills = [
      ...html.matchAll(/<span class="([^"]*rounded-full[^"]*)"><span class="text-optical-line">/g),
    ];
    expect(pills).toHaveLength(5);
    for (const [, cls] of pills) expect(cls!.split(' ')).toContain('flex');
  });
});
