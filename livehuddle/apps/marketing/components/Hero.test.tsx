import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';
import {
  CAST,
  DOOR,
  LOOP_S,
  SAY_S,
  SPACE_STAGE,
  SPEECH,
  arrivalOf,
  legsOf,
  restOf,
  type CastMember,
} from './hero-space-cast';

// docs/specs/019-marketing/marketing-site.md "Hero": the pitch and its two calls to action over the Team Pod
// filling up, drawn on the server and moved by CSS alone.

const html = renderToStaticMarkup(<Hero />);

describe('the hero', () => {
  it('pitches meetings and workshops under its two promise badges', () => {
    expect(html).toContain('>Meet and run workshops together</h1>');
    expect(html).toMatch(/aria-label="Our promises"/);
    expect(html).toContain('Free and open source');
    expect(html).toContain('No sign-up to start');
  });

  it('opens a Space from its own funnel slot, and browses the templates under it', () => {
    expect(html).toMatch(/href="\/new\?via=Home\.Hero"[^>]*>Open a Space/);
    expect(html).toMatch(/href="\/#templates"[^>]*>Browse Templates/);
  });

  it('draws the stage as decoration: the real Team Pod in both appearances, and no script', () => {
    const stage = html.slice(
      html.indexOf('aria-hidden="true" class="pointer-events-none select-none"'),
    );
    expect(stage.length).toBeLessThan(html.length);
    expect(stage).toContain('href="/hero/team-pod-light.svg"');
    expect(stage).toContain('href="/hero/team-pod-dark.svg"');
    expect(stage).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(html).not.toContain('<script');
    // Every teammate's name chip, and every line said.
    for (const { name } of CAST) expect(stage).toContain(`>${name}</text>`);
    for (const { text } of SPEECH) expect(stage).toContain(text);
  });
});

describe('the cast', () => {
  const inRoom = (p: { x: number; y: number }) =>
    p.x > -550 && p.x < 210 && p.y > -252 && p.y < 228;

  it.each(CAST.map((m) => [m.name, m] as const))('%s ends inside the pod, on the floor', (_, m) => {
    expect(inRoom(restOf(m))).toBe(true);
  });

  it.each(CAST.map((m) => [m.name, m] as const))(
    '%s walks in straight legs that add up to the path',
    (_, m: CastMember) => {
      const legs = legsOf(m);
      expect(legs).toHaveLength(m.path.length);
      const end = legs.reduce((p, l) => ({ x: p.x + l.dx, y: p.y + l.dy }), m.from);
      expect(end).toEqual(restOf(m));
      for (const leg of legs) expect(leg.dx === 0 || leg.dy === 0).toBe(true);
    },
  );

  it('comes in through the door, one at a time, and is in before anyone speaks', () => {
    const walkers = CAST.filter((m) => m.from === DOOR);
    expect(walkers.length).toBe(4);
    const starts = walkers.map((m) => m.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    const firstWord = Math.min(...SPEECH.map((s) => s.at));
    for (const m of CAST) expect(arrivalOf(m)).toBeLessThan(firstWord);
  });

  it('speaks one bubble at a time, round the whole loop', () => {
    const starts = SPEECH.map((line) => line.at % LOOP_S).sort((a, b) => a - b);
    const gaps = starts.map(
      (at, i) => (starts[(i + 1) % starts.length]! - at + LOOP_S) % LOOP_S || LOOP_S,
    );
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(SAY_S);
  });

  it('faces the way each leg goes', () => {
    const leo = CAST.find((m) => m.name === 'Leo')!;
    expect(legsOf(leo).map((l) => l.facing)).toEqual(['up', 'right', 'up']);
  });

  it('walks only on the stage, coming up from just under its foot', () => {
    for (const m of CAST) {
      expect(m.from === DOOR || inRoom(m.from)).toBe(true);
      for (const p of m.path) {
        expect(p.x).toBeGreaterThan(SPACE_STAGE.x);
        expect(p.y).toBeLessThanOrEqual(SPACE_STAGE.y + SPACE_STAGE.height);
      }
    }
  });
});
