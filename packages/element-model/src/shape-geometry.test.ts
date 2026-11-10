import { describe, expect, it } from 'vitest';
import {
  DIAMOND_POINTS,
  DRAWN_GEOMETRY_KINDS,
  browserChromeLayout,
  shapeGeometry,
  shapePathData,
  shapePolygonVertices,
  type ShapePartRole,
} from './shape-geometry';
import { shapeRoleAttrs } from './svg-shape-role';

describe('the shared geometry table', () => {
  it('draws every kind it lists, the laptop by its aspect', () => {
    for (const kind of DRAWN_GEOMETRY_KINDS) expect(shapeGeometry(kind)).not.toBeNull();
    expect(DRAWN_GEOMETRY_KINDS).toContain('laptop');
    const wide = shapeGeometry('laptop', 3)!;
    const odd = shapeGeometry('laptop', Number.NaN)!;
    expect(wide.parts.length).toBe(odd.parts.length);
  });

  it('answers null for a kind drawn some other way, never a prototype member', () => {
    for (const kind of ['rectangle', 'constructor', 'toString', '__proto__'])
      expect(shapeGeometry(kind)).toBeNull();
    expect(shapePathData('constructor')).toBeNull();
    expect(shapePolygonVertices('hasOwnProperty')).toBeNull();
  });

  it('gives a single path or polygon silhouette, and null for a compound one', () => {
    expect(shapePathData('cloud')).toMatch(/^M/);
    expect(shapePathData('diamond')).toBeNull();
    expect(shapePolygonVertices('diamond')).toEqual(
      DIAMOND_POINTS.split(' ').map((p) => p.split(',').map(Number)),
    );
    expect(shapePolygonVertices('cloud')).toBeNull();
    expect(shapePolygonVertices('laptop')).toBeNull();
  });

  it('lays a browser strip out left to right', () => {
    const { dotX, navX, pillX } = browserChromeLayout();
    expect(dotX).toHaveLength(3);
    expect(navX).toBeGreaterThan(dotX[2]!);
    expect(pillX).toBeGreaterThan(navX);
  });
});

describe('shapeRoleAttrs', () => {
  const attrs = (role: ShapePartRole) => shapeRoleAttrs(role, '#fff', '#000', 2, '4 2');
  it('paints each role as the overlay does', () => {
    expect(attrs('main')).toContain('fill="#fff"');
    expect(attrs('main')).toContain('stroke-linejoin="round"');
    expect(attrs('outline')).not.toContain('stroke-linejoin');
    expect(attrs('detail')).toContain('fill="none"');
    expect(attrs('detail')).not.toContain('stroke-dasharray');
    expect(attrs('limb')).toContain('fill="none"');
    expect(attrs('limb')).toContain('stroke-linecap="round"');
    expect(attrs('head')).toContain('fill="#fff"');
    expect(shapeRoleAttrs('main', '"', '<', 1)).toContain('fill="&quot;"');
    expect(shapeRoleAttrs('main', '#fff', '#000', 1)).not.toContain('stroke-dasharray');
  });
});
