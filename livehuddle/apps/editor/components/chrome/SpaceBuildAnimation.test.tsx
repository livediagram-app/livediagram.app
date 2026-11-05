// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpaceBuildAnimation } from './SpaceBuildAnimation';
import { PATHS, SCENE_CSS, SEATS, WALKS, segments } from './space-build-scene';

// docs/specs/007-editor/new-document-route.md "The opening screen".

// The CSS outside the motion block: what reduced motion sees.
function stillCss(css: string): string {
  const start = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  const end = css.indexOf('@media (prefers-reduced-motion: reduce)');
  return css.slice(0, start) + css.slice(end);
}

describe('SpaceBuildAnimation', () => {
  it('draws a Space, not a diagram, as one named image', () => {
    render(<SpaceBuildAnimation />);
    const art = screen.getByRole('img', { name: 'A Space coming to life' });
    expect(art.closest('[data-loading-art="space"]')).toBeTruthy();
    expect(art.textContent).toContain('Huddle Room');
    // The two characters: a seated figure and a walker each, and the teammate's name chip.
    for (const who of ['you', 'sam']) {
      expect(art.querySelector(`.lhs-${who}-sit`)).toBeTruthy();
      expect(art.querySelector(`.lhs-${who}-walk`)).toBeTruthy();
    }
    expect(art.textContent).toContain('Sam');
  });

  it('is hidden from assistive tech when the label is empty', () => {
    const { container } = render(<SpaceBuildAnimation label="" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
  });

  it('holds a calm still frame under reduced motion: seated and talking, nothing animating', () => {
    const still = stillCss(SCENE_CSS);
    // Every running animation lives in the no-preference block; reduced motion only ever turns them off.
    expect(
      still.match(/animation:[^;]*/g)?.every((a) => a.trim() === 'animation: none !important'),
    ).toBe(true);
    expect(still).toContain('@media (prefers-reduced-motion: reduce)');
    // The in-app Reduce Motion preference collapses animations to their last frame (the dissolved Space), so it
    // stops this loop outright instead.
    expect(still).toContain(':root.reduce-motion .lhs * { animation: none !important; }');
    // The walkers are the only thing hidden at rest; the seated pair, their bars and the ring show.
    expect(still).toContain('.lhs-walk { opacity: 0; }');
    expect(still).not.toMatch(/\.lhs-(you|sam)-(sit|talk)\s*\{/);
    expect(still).not.toMatch(/\.lhs-ring\s*\{[^}]*opacity/);
  });

  it('animates on the compositor only: every keyframe moves transform or opacity', () => {
    const bodies = [...SCENE_CSS.matchAll(/@keyframes [\w-]+ \{(.*?)\}\s*\}/gs)].map((m) => m[1]!);
    expect(bodies.length).toBeGreaterThan(20);
    for (const body of bodies) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const prop of props) {
        expect(['opacity', 'transform', 'animation-timing-function']).toContain(prop);
      }
    }
  });
});

describe('segments', () => {
  it('walks each character in through the door to its seat, facing the way it goes', () => {
    for (const who of ['you', 'sam'] as const) {
      const segs = segments(PATHS[who], WALKS[who]);
      expect(segs.map((s) => s.view)).toEqual(
        who === 'you' ? ['up', 'left', 'up', 'right'] : ['up', 'right', 'up', 'left'],
      );
      expect(segs[0]!.t0).toBe(WALKS[who][0]);
      expect(segs.at(-1)!.t1).toBeCloseTo(WALKS[who][1], 1);
      expect(segs.at(-1)!.to).toEqual(SEATS[who]);
      for (let i = 1; i < segs.length; i++) expect(segs[i]!.t0).toBe(segs[i - 1]!.t1);
    }
  });
});
