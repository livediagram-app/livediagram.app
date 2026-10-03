// @vitest-environment jsdom
// The route port against draw.io itself: every edge of every hand-written fixture page routes to
// the path draw.io desktop's CLI draws (goldens from scripts/drawio-route-goldens.mts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGraph } from '../cells';
import { createPageRouter } from './page';

const FIXTURES = join(__dirname, '..', '__fixtures__');

function pagesOf(name: string): Element[] {
  const xml = readFileSync(join(FIXTURES, name), 'utf8');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('mxGraphModel'));
}

type Goldens = Record<string, Record<string, [number, number][]>>;
const goldensOf = (name: string): Goldens =>
  JSON.parse(readFileSync(join(FIXTURES, 'routes', name.replace('.drawio', '.json')), 'utf8'));

// draw.io writes its SVG paths to two decimals.
const TOLERANCE = 0.02;

describe.each([
  'routes.drawio',
  'flowchart.drawio',
  'swimlanes.drawio',
  'uml.drawio',
  'cloud-architecture.drawio',
])('routes of %s', (name) => {
  const pages = pagesOf(name);
  const goldens = goldensOf(name);
  const cases = Object.entries(goldens).flatMap(([page, edges]) =>
    Object.entries(edges).map(([id, points]) => ({ page: Number(page), id, points })),
  );

  it.each(cases)('draws page $page edge $id as draw.io does', ({ page, id, points }) => {
    const route = createPageRouter(readGraph(pages[page]!))(id);
    const got = route?.drawn.map((p) => [p.x, p.y]) ?? [];
    expect(got).toHaveLength(points.length);
    got.forEach(([x, y], i) => {
      expect(Math.abs(x! - points[i]![0]), `point ${i} x`).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(y! - points[i]![1]), `point ${i} y`).toBeLessThanOrEqual(TOLERANCE);
    });
  });
});
