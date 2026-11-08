import { describe, expect, it } from 'vitest';
import { labelBoxSize } from './label-box-size';

// A box sized to its label, as an agent's `add` sizes one (livediagram/docs/specs/015-api/mcp-server.md §4.7).

describe('template sizing', () => {
  it('never draws a palette square: steps are wide and short, decisions wider than tall', () => {
    const step = labelBoxSize('Pay', 'square', { textSize: 'md' });
    expect(step.width).toBeGreaterThanOrEqual(180);
    expect(step.height).toBeLessThan(step.width / 2);
    const decision = labelBoxSize('Ok?', 'diamond', { textSize: 'md' });
    expect(decision.width).toBeGreaterThan(decision.height);
    const circle = labelBoxSize('Learn', 'circle', { textSize: 'md' });
    expect(circle.width).toBe(circle.height);
  });

  it('measures a label written over several lines line by line, without the look too', () => {
    // Five short lines: as narrow as the widest, as tall as five lines (one long line would be wide and two tall).
    const five = labelBoxSize('Step one\nStep two\nStep three\nStep four\nStep five', 'square');
    expect(five.width).toBeLessThan(labelBoxSize('Step one Step two Step three', 'square').width);
    expect(five.height).toBeGreaterThan(labelBoxSize('Step one', 'square').height);
  });

  it('measures at a given font size, wider for a larger one', () => {
    const sm = labelBoxSize('Search service', 'square', { textSize: 'sm' });
    const lg = labelBoxSize('Search service', 'square', { textSize: 'md', fontPx: 32 });
    expect(lg.width).toBeGreaterThan(
      labelBoxSize('Search service', 'square', { textSize: 'md' }).width,
    );
    expect(lg.width).toBeGreaterThan(sm.width);
  });

  it('keeps the floor for an empty label, a sibling floor when given, and a diamond roomier', () => {
    expect(labelBoxSize('', 'square', { textSize: 'md' })).toEqual({ width: 180, height: 64 });
    expect(labelBoxSize('', 'square')).toEqual(labelBoxSize(undefined, 'square'));
    const floor = { width: 220, height: 80 };
    expect(labelBoxSize('Go', 'square', { textSize: 'sm' }, false, floor)).toEqual(floor);
    const icon = labelBoxSize('Search service', 'square', { textSize: 'md' }, true);
    expect(icon.width).toBeGreaterThan(
      labelBoxSize('Search service', 'square', { textSize: 'md' }).width,
    );
    const long = 'A rather long decision label that wraps';
    expect(labelBoxSize(long, 'diamond').width).toBeGreaterThan(labelBoxSize(long, 'square').width);
  });
});

describe('a label over two lines', () => {
  it('is measured line by line: narrower than one line holding both, and taller', () => {
    const one = labelBoxSize('App tasks on ECS Fargate in two zones', 'square', { textSize: 'md' });
    const two = labelBoxSize('App tasks on ECS\nFargate in two zones', 'square', {
      textSize: 'md',
    });
    expect(two.width).toBeLessThan(one.width);
    expect(two.height).toBeGreaterThanOrEqual(one.height);
  });
});
