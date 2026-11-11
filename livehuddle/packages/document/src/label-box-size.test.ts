import { describe, expect, it } from 'vitest';
import { labelBoxSize } from './label-box-size';

// A box sized to its label, as an agent's `add` sizes one (livediagram/docs/specs/015-api/mcp-server.md §4.7).

describe('template sizing', () => {
  it("starts from the kind's palette size and widens for a longer label", () => {
    expect(labelBoxSize('Go', 'focus-button', { textSize: 'md' })).toEqual({
      width: 120,
      height: 96,
    });
    const long = labelBoxSize('A much longer label than that', 'focus-button', { textSize: 'md' });
    expect(long.width).toBeGreaterThan(120);
  });

  it('measures a label written over several lines line by line, without the look too', () => {
    // Five short lines: as narrow as the widest, as tall as five lines (one long line would be wide and two tall).
    const five = labelBoxSize(
      'Step one\nStep two\nStep three\nStep four\nStep five',
      'focus-button',
    );
    expect(five.width).toBeLessThan(
      labelBoxSize('Step one Step two Step three', 'focus-button').width,
    );
    expect(five.height).toBeGreaterThan(labelBoxSize('Step one', 'focus-button').height);
  });

  it('measures at a given font size, wider for a larger one', () => {
    const sm = labelBoxSize('Search service', 'focus-button', { textSize: 'sm' });
    const lg = labelBoxSize('Search service', 'focus-button', { textSize: 'md', fontPx: 32 });
    expect(lg.width).toBeGreaterThan(
      labelBoxSize('Search service', 'focus-button', { textSize: 'md' }).width,
    );
    expect(lg.width).toBeGreaterThan(sm.width);
  });

  it('keeps the floor for an empty label and a sibling floor when given', () => {
    expect(labelBoxSize('', 'focus-button', { textSize: 'md' })).toEqual({
      width: 120,
      height: 96,
    });
    expect(labelBoxSize('', 'focus-button')).toEqual(labelBoxSize(undefined, 'focus-button'));
    const floor = { width: 220, height: 80 };
    expect(labelBoxSize('Go', 'focus-button', { textSize: 'sm' }, false, floor)).toEqual(floor);
    const icon = labelBoxSize('Search service', 'focus-button', { textSize: 'md' }, true);
    expect(icon.width).toBeGreaterThan(
      labelBoxSize('Search service', 'focus-button', { textSize: 'md' }).width,
    );
  });
});

describe('a label over two lines', () => {
  it('is measured line by line: narrower than one line holding both, and taller', () => {
    const one = labelBoxSize('App tasks on ECS Fargate in two zones', 'focus-button', {
      textSize: 'md',
    });
    const two = labelBoxSize('App tasks on ECS\nFargate in two zones', 'focus-button', {
      textSize: 'md',
    });
    expect(two.width).toBeLessThan(one.width);
    expect(two.height).toBeGreaterThanOrEqual(one.height);
  });
});
