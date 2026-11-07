import { describe, expect, it } from 'vitest';
import { stageTop, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { buildHotelRooftop } from './template-builders-hotel';
import type { TemplateKind } from './templates';

type Shape = Extract<Element, { type: 'shape' }>;
const shapesOf = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');
const build = (kind: TemplateKind) => shapesOf(buildTemplate(kind, 0, 0));
const count = (els: Shape[], shape: string) => els.filter((e) => e.shape === shape).length;
const inside = (p: Shape, r: { x: number; y: number; width: number; height: number }) =>
  p.x >= r.x && p.y >= r.y && p.x + p.width <= r.x + r.width && p.y + p.height <= r.y + r.height;

// docs/specs/009-elements/venue-pieces.md "In the templates".
describe('the venue pieces in the templates', () => {
  it('hangs curtains over the event stages, each framing its stage, and stands a podium on its top', () => {
    for (const kind of ['all-hands-hall', 'expo-hall', 'conference-venue'] as const) {
      const els = build(kind);
      const curtains = els.find((e) => e.shape === 'stage-curtains')!;
      const podium = els.find((e) => e.shape === 'podium')!;
      expect(curtains, kind).toBeDefined();
      // The stage the curtains hang over: they span it, their drapes ending above its front edge.
      const stage = els.find(
        (e) =>
          e.shape === 'stage' &&
          curtains.x <= e.x + 10 &&
          curtains.x + curtains.width >= e.x + e.width - 10,
      )!;
      expect(stage, kind).toBeDefined();
      const top = stageTop(stage);
      expect(curtains.y + curtains.height, kind).toBeLessThanOrEqual(top.y + top.height);
      expect(curtains.y + curtains.height, kind).toBeGreaterThan(top.y + top.height / 2);
      // The podium stands on the stage's top, its foot clear of the front edge.
      expect(inside(podium, top), kind).toBe(true);
    }
    const training = build('training-room');
    expect(count(training, 'podium')).toBe(1);
    expect(count(training, 'stage-curtains')).toBe(0);
  });

  it('gives the Expo Hall four pillars and the Hotel lobby four columns', () => {
    expect(count(build('expo-hall'), 'pillar')).toBe(4);
    expect(count(build('hotel-and-suites'), 'column')).toBe(4);
  });

  it('puts a swimming pool on the Hotel rooftop, in place of its pond, and on the beach', () => {
    const roof = shapesOf(buildHotelRooftop(0, 0));
    expect(count(roof, 'swimming-pool')).toBe(1);
    expect(count(roof, 'pond')).toBe(0);
    const beach = build('beach-offsite');
    expect(count(beach, 'swimming-pool')).toBe(1);
    expect(count(beach, 'pond')).toBe(1);
  });

  it('parks cars and bikes by the Company Campus gate, and bikes by the Startup HQ’s', () => {
    const campus = build('company-campus');
    expect(count(campus, 'car-park')).toBe(2);
    expect(count(campus, 'bike-rack')).toBe(1);
    // The car parks side by side, one row.
    const [a, b] = campus.filter((e) => e.shape === 'car-park');
    expect(a!.y).toBe(b!.y);
    expect(count(build('startup-hq'), 'bike-rack')).toBe(1);
  });
});
