// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  MIN_TEXT_CONTRAST,
  progressLabelInks,
  type ShapeElement,
} from '@livediagram/document';
import { ProgressView } from './ProgressView';

// docs/specs/009-elements/progress.md "The percentage stays legible": the bar's percentage is inked
// per part, each copy clipped to the part it sits over.

const bar = (o: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'pb',
  type: 'shape',
  shape: 'progress-bar',
  x: 0,
  y: 0,
  width: 220,
  height: 44,
  progress: 73,
  ...o,
});

// jsdom normalises a hex colour to rgb(); compare in that form.
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll('span')].map((s) => s.parentElement as HTMLElement);

describe('ProgressView bar label', () => {
  it('draws one label when the filled portion and the track take the same ink', () => {
    const { container } = render(
      <ProgressView element={bar()} accent="#1d4ed8" track="#141b26" textColor="#ffffff" />,
    );
    const [only, ...rest] = labels(container);
    expect(rest).toHaveLength(0);
    expect(only!.style.color).toBe(rgb('#ffffff'));
    expect(only!.style.clipPath).toBe('');
  });

  it('splits a label straddling the edge into one copy per part, each readable on its part', () => {
    const accent = '#1d4ed8';
    const track = '#e2e8f0';
    const inks = progressLabelInks('#ffffff', accent, track);
    expect(contrastRatio(inks.onFill, accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(inks.onTrack, track)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    const { container } = render(
      <ProgressView element={bar()} accent={accent} track={track} textColor="#ffffff" />,
    );
    const [onTrack, onFill] = labels(container);
    expect(onTrack!.style.color).toBe(rgb(inks.onTrack));
    expect(onTrack!.style.clipPath).toBe('inset(0 0 0 73%)');
    expect(onTrack!.getAttribute('aria-hidden')).toBeNull();
    expect(onFill!.style.color).toBe(rgb(inks.onFill));
    expect(onFill!.style.clipPath).toBe('inset(0 27% 0 0)');
    expect(onFill!.getAttribute('aria-hidden')).toBe('true');
  });

  it('grows the clips with the fill under the Fill animation', () => {
    const { container } = render(
      <ProgressView
        element={bar({ progressAnim: 'fill' })}
        accent="#1d4ed8"
        track="#e2e8f0"
        textColor="#ffffff"
      />,
    );
    const [onTrack, onFill] = labels(container);
    expect(onTrack!.className).toContain('lvd-prog-ink-track');
    expect(onFill!.className).toContain('lvd-prog-ink-fill');
  });

  it('keeps the ring label in the text colour', () => {
    const { container } = render(
      <ProgressView
        element={bar({ shape: 'progress-ring' })}
        accent="#1d4ed8"
        track="#e2e8f0"
        textColor="#ffffff"
      />,
    );
    const all = labels(container);
    expect(all).toHaveLength(1);
    expect(all[0]!.style.color).toBe(rgb('#ffffff'));
  });
});

// docs/specs/009-elements/progress.md "The percentage's size": the ring's label is a share of its
// diameter (floor 14, ceiling 64), the bar's a fixed 14 px.
describe('ProgressView label size', () => {
  const size = (el: ShapeElement) => {
    const { container } = render(
      <ProgressView element={el} accent="#1d4ed8" track="#e2e8f0" textColor="#111111" />,
    );
    return container.querySelector('span')!.style.fontSize;
  };

  it.each([
    [40, '14px'],
    [130, '26px'],
    [180, '36px'],
    [1000, '64px'],
  ])('draws a %ipx ring at %s', (side, px) => {
    expect(size(bar({ shape: 'progress-ring', width: side, height: side }))).toBe(px);
  });

  it('keeps the bar at 14px whatever its box', () => {
    expect(size(bar({ width: 600, height: 200 }))).toBe('14px');
  });
});
