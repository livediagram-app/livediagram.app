import { describe, expect, it } from 'vitest';
import {
  angledElbow,
  arrowPathD,
  arrowPathMidpoint,
  curveControlPoint,
  type Endpoint,
} from './index';

// Free endpoints just carry coordinates — used everywhere a pinned
// anchor would otherwise dictate direction.
const free = (x: number, y: number): Endpoint => ({ kind: 'free', x, y });

describe('arrowPathD', () => {
  it('renders a straight line as a single M…L between the endpoints', () => {
    const d = arrowPathD(
      'straight',
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      free(10, 20),
      free(30, 40),
    );
    expect(d).toBe('M 10 20 L 30 40');
  });

  it('renders an angled connector as M…L…L with one bend', () => {
    // Horizontal-first when |dx| >= |dy| and both ends are free.
    const d = arrowPathD('angled', { x: 0, y: 0 }, { x: 100, y: 40 }, free(0, 0), free(100, 40));
    expect(d).toBe('M 0 0 L 100 0 L 100 40');
  });

  it('renders a curved arrow as a quadratic bezier (M…Q…)', () => {
    const d = arrowPathD('curved', { x: 0, y: 0 }, { x: 100, y: 0 }, free(0, 0), free(100, 0));
    // Control point is perpendicular to the chord midpoint at ¼ the
    // chord length; for a horizontal chord that's straight up/down.
    expect(d).toMatch(/^M 0 0 Q [\d.-]+ [\d.-]+ 100 0$/);
  });

  it('degenerate curved (zero-length chord) falls back to a straight line', () => {
    const d = arrowPathD('curved', { x: 5, y: 5 }, { x: 5, y: 5 }, free(5, 5), free(5, 5));
    expect(d).toBe('M 5 5 L 5 5');
  });
});

describe('arrowPathMidpoint', () => {
  it('returns the chord midpoint for a straight arrow', () => {
    const m = arrowPathMidpoint(
      'straight',
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      free(0, 0),
      free(100, 40),
    );
    expect(m).toEqual({ x: 50, y: 20 });
  });

  it('returns the elbow vertex for an angled arrow', () => {
    // Same horizontal-first heuristic as the path itself, so the
    // elbow sits at (to.x, from.y) for a wider-than-tall connector.
    const m = arrowPathMidpoint(
      'angled',
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      free(0, 0),
      free(100, 40),
    );
    expect(m).toEqual({ x: 100, y: 0 });
  });
});

describe('curveControlPoint', () => {
  it('places the auto-bow perpendicular to the chord at the midpoint when no override is set', () => {
    // 100-wide horizontal chord: auto-bow runs 25 units down (the
    // perpendicular's positive direction in screen-space is +y).
    const c = curveControlPoint({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(c).toEqual({ x: 50, y: 25 });
  });

  it('uses the supplied offset from the chord midpoint when set', () => {
    // Same chord, user has dragged the curve handle 40px right and
    // 60px down from the midpoint. We expect chord-midpoint + offset.
    const c = curveControlPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, { dx: 40, dy: 60 });
    expect(c).toEqual({ x: 90, y: 60 });
  });

  it('returns the midpoint when the chord has zero length and no override is set', () => {
    // Degenerate case: a curved arrow whose endpoints coincide.
    const c = curveControlPoint({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(c).toEqual({ x: 5, y: 5 });
  });

  it('threads the override through arrowPathD so the rendered Q goes through the user point', () => {
    const d = arrowPathD('curved', { x: 0, y: 0 }, { x: 100, y: 0 }, free(0, 0), free(100, 0), {
      dx: 40,
      dy: 60,
    });
    expect(d).toBe('M 0 0 Q 90 60 100 0');
  });
});

describe('angledElbow', () => {
  // The elbow handle (spec/09 Arrows / Manipulating arrows) lets
  // the user drag the right-angle corner of an angled arrow to a
  // non-default position. The default corner is at (to.x, from.y)
  // for horizontal-first arrows or (from.x, to.y) for vertical-
  // first. `elbowOffset` translates that auto-corner so the user's
  // chosen bend survives endpoint moves: the auto-corner shifts
  // with the endpoints, the offset stays the same.

  it('returns the auto-corner when no offset is set (horizontal-first)', () => {
    // Free endpoints with a longer horizontal-than-vertical chord
    // → horizontal-first → corner sits at (to.x, from.y).
    const elbow = angledElbow({ x: 0, y: 0 }, { x: 100, y: 50 }, free(0, 0), free(100, 50));
    expect(elbow).toEqual({ x: 100, y: 0 });
  });

  it('returns the auto-corner when no offset is set (vertical-first)', () => {
    // Free endpoints with a longer vertical-than-horizontal chord
    // → vertical-first → corner sits at (from.x, to.y).
    const elbow = angledElbow({ x: 0, y: 0 }, { x: 50, y: 100 }, free(0, 0), free(50, 100));
    expect(elbow).toEqual({ x: 0, y: 100 });
  });

  it('translates the auto-corner by elbowOffset when one is supplied', () => {
    // User has dragged the elbow 30px right + 20px down from the
    // auto-corner.
    const elbow = angledElbow({ x: 0, y: 0 }, { x: 100, y: 50 }, free(0, 0), free(100, 50), {
      dx: 30,
      dy: 20,
    });
    expect(elbow).toEqual({ x: 130, y: 20 });
  });

  it('threads the offset through arrowPathD so the rendered L goes through the dragged point', () => {
    // Angled arrow with a custom elbow at (130, 20). The path
    // should read M from L elbow L to.
    const d = arrowPathD(
      'angled',
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      free(0, 0),
      free(100, 50),
      undefined,
      { dx: 30, dy: 20 },
    );
    expect(d).toBe('M 0 0 L 130 20 L 100 50');
  });

  it('keeps arrowPathMidpoint anchored to the user-dragged elbow on angled arrows', () => {
    // The label / midpoint on an angled arrow sits at the elbow.
    // A regression that ignores the offset would put the label
    // back at the auto-corner.
    const mid = arrowPathMidpoint(
      'angled',
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      free(0, 0),
      free(100, 50),
      undefined,
      { dx: 30, dy: 20 },
    );
    expect(mid).toEqual({ x: 130, y: 20 });
  });
});
