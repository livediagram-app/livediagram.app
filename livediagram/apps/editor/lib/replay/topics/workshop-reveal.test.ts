import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { CHAPTERS, COVER, DEMO_IDS, REACT, reveal } from './workshop-reveal';

// Reactions and Reveals (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop). What every topic must
// hold is in topics.test.ts.

const tab = { id: 't', name: 'Tab', elements: [], backgroundColor: '#ffffff' } as unknown as Tab;
const centre = { x: 400, y: 300 };
const layout = reveal.layout({ centre, tab });
const cover = (ms: number) =>
  reveal.frame(1, ms, layout).elements.find((e) => e.id === DEMO_IDS.cover) as
    ShapeElement | undefined;

describe('Reactions and Reveals', () => {
  it('plays Reactions, Reveal', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['reveal-react', 'reveal-cover']);
  });

  it('makes a confetti pad and a reveal zone as their tiles do, above the player', () => {
    expect(layout.pad).toMatchObject({
      shape: 'reaction-pad',
      reaction: 'confetti',
      label: 'Celebrate',
    });
    expect(layout.cover.shape).toBe('reveal');
    for (const el of [layout.pad, layout.cover])
      expect(el.y + el.height).toBeLessThanOrEqual(centre.y + 80);
  });

  it('opens Session on React for the pad and closes both as the carry leaves', () => {
    const open = (ms: number) => reveal.frame(0, ms, layout).open;
    expect(open(REACT.open)).toEqual(['bar-session']);
    expect(open(REACT.group)).toEqual(['bar-session', 'session-react']);
    expect(open(REACT.carry[0] + 300)).toEqual([]);
    expect(reveal.frame(0, REACT.carry[1], layout).elements.at(-1)).toEqual(layout.pad);
  });

  it('picks the Reveal Zone on Session Tools, then drags it out from its corner over both answers', () => {
    expect(reveal.frame(1, COVER.group, layout).open).toEqual(['bar-session', 'session-tools']);
    expect(reveal.frame(1, COVER.pick + 300, layout).open).toEqual([]);
    expect(cover(COVER.drag[0] - 1)).toBeUndefined();
    const mid = cover((COVER.drag[0] + COVER.drag[1]) / 2)!;
    expect(mid.x).toBe(layout.cover.x);
    expect(mid.width).toBeLessThan(layout.cover.width);
    expect(reveal.frame(1, (COVER.drag[0] + COVER.drag[1]) / 2, layout).hold).toEqual({
      x: mid.x + mid.width,
      y: mid.y + mid.height,
    });
    const done = cover(COVER.drag[1])!;
    expect(done).toEqual(layout.cover);
    for (const a of layout.answers) {
      expect(a.x).toBeGreaterThanOrEqual(done.x);
      expect(a.y).toBeGreaterThanOrEqual(done.y);
      expect(a.x + a.width).toBeLessThanOrEqual(done.x + done.width);
      expect(a.y + a.height).toBeLessThanOrEqual(done.y + done.height);
    }
    // Drawn after the answers, so its cover is over them.
    expect(reveal.frame(1, COVER.drag[1], layout).elements.at(-1)!.id).toBe(DEMO_IDS.cover);
  });

  it("presses Session's rail by place: React third, Tools first", () => {
    const rows = [0, 1].map((i) =>
      reveal
        .plan(i, layout)
        .flatMap((w) =>
          w.to.kind === 'find' && w.to.selector.startsWith('nav') ? [w.to.selector] : [],
        ),
    );
    expect(rows).toEqual([
      ['nav[aria-label="session tools groups"] > button:nth-child(3)'],
      ['nav[aria-label="session tools groups"] > button:nth-child(1)'],
    ]);
  });
});
