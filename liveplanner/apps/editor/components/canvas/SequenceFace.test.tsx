// @vitest-environment jsdom

// The sequence diagram's face (docs/specs/009-elements/sequence-diagram.md, blueprint sequence-diagram.md).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { SequenceFace } from './SequenceFace';
import { CanvasFinishProvider } from './CanvasFinishContext';

afterEach(cleanup);

const seq = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('sequence', 0, 0), ...over }) as ShapeElement;

describe('SequenceFace', () => {
  it('draws the picture fitted to the box, labelled with its participants', () => {
    render(<SequenceFace element={seq()} paper="#ffffff" />);
    const img = screen.getByRole('img', {
      name: 'Sequence diagram: Browser, API, Database; 5 messages',
    });
    const svg = img.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(img.textContent).toContain('Place order');
  });

  it('plays once, or loops with Repeat, over 0.4 s a message scaled by speed', () => {
    const { rerender } = render(
      <SequenceFace
        element={seq({ sequenceAnim: 'play', sequenceAnimSpeed: 'normal' })}
        paper="#fff"
      />,
    );
    const img = screen.getByRole('img');
    expect(img.className).toContain('lvd-seq-play');
    expect(img.style.getPropertyValue('--lvd-seq-dur')).toBe('2s');
    rerender(
      <SequenceFace
        element={seq({
          sequenceAnim: 'play',
          sequenceAnimRepeat: true,
          sequenceAnimSpeed: 'normal',
        })}
        paper="#fff"
      />,
    );
    expect(screen.getByRole('img').className).toContain('lvd-seq-play-loop');
  });

  it('is still without Play', () => {
    render(<SequenceFace element={seq()} paper="#fff" />);
    expect(screen.getByRole('img').className).not.toContain('lvd-seq');
  });

  it("wears the element's look: its accent, ink and face, and the tab's finish", () => {
    const look = { paper: '#dcfce7', stroke: '#15803d', ink: '#14532d', fontFamily: 'Lora, serif' };
    const { container } = render(
      <CanvasFinishProvider finish="sketch">
        <SequenceFace element={seq()} {...look} />
      </CanvasFinishProvider>,
    );
    const markup = container.innerHTML;
    expect(markup).toContain('stroke="#15803d"');
    expect(markup).toContain('fill="#14532d"');
    // No sky-blue default and no other face left on the picture.
    expect(markup).not.toMatch(/#0ea5e9|#075985|#f0f9ff/i);
    const faces = [...container.querySelectorAll('[font-family]')].map((n) =>
      n.getAttribute('font-family'),
    );
    expect(faces.length).toBeGreaterThan(0);
    expect(new Set(faces)).toEqual(new Set(['Lora, serif']));
    // Sketch draws the participants' boxes by hand: stroked paths, not crisp rects.
    const flexible = render(<SequenceFace element={seq()} {...look} />).container.innerHTML;
    expect(markup).not.toBe(flexible);
  });
});
