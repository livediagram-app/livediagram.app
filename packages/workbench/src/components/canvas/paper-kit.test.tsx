// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialTicks, ReelWindow, keycapEdge } from './paper-kit';

// docs/specs/012-collaboration/participant-responses.md "paper kit": decorative, in the element's own colour.
describe('paper kit', () => {
  it('draws the reel window and the dial ticks hidden from assistive tech and the pointer', () => {
    const { container } = render(
      <>
        <ReelWindow textColor="#336699" />
        <DialTicks textColor="#336699" />
        <DialTicks textColor="#336699" ticks={7} />
      </>,
    );
    const [reel, dial, short] = [...container.children] as HTMLElement[];
    for (const el of [reel!, dial!, short!]) {
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.className).toContain('pointer-events-none');
    }
    expect(dial!.children).toHaveLength(24);
    // Every sixth tick is a quarter mark, taller than the rest.
    const ticks = [...short!.children] as HTMLElement[];
    expect(ticks.map((t) => t.style.height)).toEqual([
      '7px',
      '4px',
      '4px',
      '4px',
      '4px',
      '4px',
      '7px',
    ]);
    expect(ticks.at(-1)!.style.left).toBe('100%');
  });

  it('builds a keycap edge from the text colour alone', () => {
    const edge = keycapEdge('#336699');
    expect(String(edge.boxShadow).split('inset').length).toBe(4);
  });
});
