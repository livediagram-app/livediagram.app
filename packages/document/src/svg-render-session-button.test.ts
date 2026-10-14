import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import { svgBoxed } from './svg-render';
import type { BoxedElement } from './index';

// docs/specs/012-collaboration/facilitate-mode.md: a Session button in an image draws as the canvas does.
const button = (session?: unknown) =>
  ({
    ...createShape('session-button', 0, 0),
    id: 's',
    label: '',
    session,
  }) as unknown as BoxedElement;
// Each <text>'s plain words, read by index rather than a regex, so the scan stays linear in the svg.
const texts = (svg: string) =>
  svg
    .split('<text')
    .slice(1)
    .map((chunk) => chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</text>')))
    .filter((words) => !words.includes('<'));

describe('a Session button in an export', () => {
  it('draws the timer for a button with no tool, or one it does not know, as the canvas does', () => {
    for (const session of [undefined, { tool: 'quiz' }]) {
      const svg = svgBoxed(button(session));
      expect(svg, JSON.stringify(session)).toContain('5:00');
    }
  });

  it('wraps a long poll question to two lines within the button', () => {
    const question = 'What should we prioritise for the next quarter given the budget we have?';
    const svg = svgBoxed(button({ tool: 'poll', style: 'yesNo', question }));
    const lines = texts(svg).filter((t) => t && !/^ask/i.test(t));
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(svg).not.toContain(question);
    for (const line of lines) expect(line.length).toBeLessThan(20);
  });
});
