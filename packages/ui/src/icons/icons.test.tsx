// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import * as icons from './index';
import type { IconProps } from './Glyph';

// Every exported icon component (everything ending in `Icon`), so a new one
// is covered the moment it is exported.
const ICONS = (Object.entries(icons) as [string, unknown][]).filter(
  (entry): entry is [string, ComponentType<IconProps>] =>
    entry[0].endsWith('Icon') && typeof entry[1] === 'function',
);

describe('shared chrome icons', () => {
  it('exports icons to check', () => {
    expect(ICONS.length).toBeGreaterThan(20);
  });

  it.each(ICONS)('%s renders a decorative svg at the requested size', (_name, Icon) => {
    const { container } = render(<Icon size={23} className="probe" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('width')).toBe('23');
    expect(svg!.getAttribute('height')).toBe('23');
    expect(svg!.getAttribute('class')).toBe('probe');
    // Colour always comes from the parent's text colour.
    const paint = svg!.getAttribute('stroke') ?? svg!.getAttribute('fill');
    expect(paint).toBe('currentColor');
  });

  const onScreenPx = (svg: SVGSVGElement) => {
    const units = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    return (Number(svg.getAttribute('stroke-width')) * Number(svg.getAttribute('width'))) / units;
  };

  it.each(ICONS.filter(([n]) => n !== 'SparkleIcon'))(
    '%s draws the house weight in on-screen px, whatever its viewBox',
    (_name, Icon) => {
      const at16 = render(<Icon size={16} />).container.querySelector('svg')!;
      expect(onScreenPx(at16)).toBeCloseTo(1.5, 5);
      const at12 = render(<Icon size={12} />).container.querySelector('svg')!;
      expect(onScreenPx(at12)).toBeCloseTo(1.25, 5);
    },
  );

  it('honours an on-screen weight override', () => {
    const svg = render(<icons.TrashIcon size={16} weight={2} />).container.querySelector('svg')!;
    expect(onScreenPx(svg)).toBeCloseTo(2, 5);
  });
});
