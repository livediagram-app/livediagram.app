import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { MAP_GEOMETRY } from './map-geometry.generated';
import { svgMap } from './svg-render-map';
import { svgBoxed } from './svg-render';
import { provideMapGeometry } from './map-model';

const COLOURS = { land: '#dbe3ec', accent: '#3b82f6', paper: '#ffffff', text: '#0f172a' };

describe('svgMap (docs/specs/009-elements/map.md "Exports and other surfaces")', () => {
  const map = {
    ...createShape('map', 10, 20),
    id: 'm<1>',
    mapHighlights: ['FR'],
    mapPins: [{ id: 'p', lat: 48.85, lon: 2.35, label: 'Paris & Co' }],
  };

  it('draws every country, the highlight, the pin and its haloed label, clipped to the box', () => {
    const svg = svgMap(map, COLOURS, 'Inter', MAP_GEOMETRY);
    expect(svg.match(/<path /g)).toHaveLength(MAP_GEOMETRY.countries.length);
    expect(svg).toContain('<clipPath id="mapclip-m_1_">');
    expect(svg).toContain('fill="#3b82f6"');
    expect(svg).toContain('<circle');
    expect(svg).toContain('paint-order="stroke"');
    expect(svg).toContain('>Paris &amp; Co</text>');
    expect(svg).toContain('font-family="Inter"');
  });

  it('draws the placeholder and the pins while no geometry is provided', () => {
    const svg = svgMap(map, COLOURS, undefined, null);
    expect(svg).not.toContain('<path ');
    expect(svg).toContain('opacity="0.6"');
    expect(svg).toContain('<circle');
  });

  it('draws nothing in a box too small for a map', () => {
    expect(svgMap({ ...map, width: 2 }, COLOURS, undefined, MAP_GEOMETRY)).toBe('');
  });

  it('is the body a map exports with, borderless, in its accent', () => {
    provideMapGeometry(MAP_GEOMETRY);
    const svg = svgBoxed(map);
    expect(svg).toContain('clip-path="url(#mapclip-m_1_)"');
    expect(svg).toContain('fill="#3b82f6"');
    expect(svg.match(/<path /g)!.length).toBeGreaterThanOrEqual(MAP_GEOMETRY.countries.length);
  });
});
