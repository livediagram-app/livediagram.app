import { describe, expect, it } from 'vitest';
import { stageTop, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { FESTIVAL_STAGE } from './template-builders-festival';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { isInTemplateCategory, templateCategory } from './template-categories';
import { templateFloors } from './template-floors';

// docs/specs/012-collaboration/virtual-office-template.md "Venues": the Festival Field, the open-air venue (Work
// Tracker #648). The rules every site keeps (doors, signs, paths, aisles, the pad on open floor) are held in
// template-builders-campus.test.ts and template-builders-spaces-more.test.ts; this file holds what it promises.

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };
const all = buildTemplate('festival-field', 0, 0).filter((e): e is Shape => e.type === 'shape');
const of = (shape: string) => all.filter((e) => e.shape === shape);
const rooms = of('room');
const room = (name: string) => rooms.find((r) => r.label === name)!;
const inside = (p: Box, r: Box) =>
  p.x >= r.x && p.y >= r.y && p.x + p.width <= r.x + r.width && p.y + p.height <= r.y + r.height;
const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

describe('the Festival Field', () => {
  it('is a Venue, cross-listed in Outdoor, one tab laid on grass', () => {
    expect(templateCategory('festival-field')).toBe('venues');
    expect(isInTemplateCategory('festival-field', 'outdoor')).toBe(true);
    expect(templateFloors('festival-field')).toEqual([]);
    expect(templateCanvasOverrides('festival-field').backgroundPattern).toBe('grass');
    expect(of('grass')).toHaveLength(1);
  });

  it('stands the Main Stage out on the grass, its curtains behind it, a Screen either side and Bring Focus by it', () => {
    const [stage] = of('stage');
    expect(of('stage')).toHaveLength(1);
    expect(stage).toMatchObject({
      label: 'Main Stage',
      stageCameras: true,
      width: FESTIVAL_STAGE.w,
      height: FESTIVAL_STAGE.h,
    });
    // Open-air: in no tent, heard by the whole tab.
    expect(rooms.some((r) => meets(r, stage!))).toBe(false);
    // The curtains span it, their drapes ending on its top, above its front edge.
    const [curtains] = of('stage-curtains');
    const top = stageTop(stage!);
    expect(curtains!.x).toBe(stage!.x);
    expect(curtains!.width).toBe(stage!.width);
    expect(curtains!.y).toBeLessThan(stage!.y);
    expect(curtains!.y + curtains!.height).toBeLessThanOrEqual(top.y + top.height);
    expect(curtains!.y + curtains!.height).toBeGreaterThan(top.y + top.height / 2);
    const screens = of('screen');
    expect(screens).toHaveLength(2);
    expect(screens.filter((s) => s.x + s.width <= stage!.x)).toHaveLength(1);
    expect(screens.filter((s) => s.x >= stage!.x + stage!.width)).toHaveLength(1);
    const [focus] = of('focus-button');
    expect(focus).toBeDefined();
    expect(
      Math.hypot(centre(focus!).x - centre(stage!).x, centre(focus!).y - centre(stage!).y),
    ).toBeLessThan(500);
  });

  it('lands everyone on the crowd field in front of the stage, in no tent', () => {
    const [stage] = of('stage');
    const [pad] = of('avatar-pad');
    expect(pad!.y).toBeGreaterThan(stage!.y + stage!.height);
    expect(Math.abs(centre(pad!).x - centre(stage!).x)).toBeLessThan(100);
    expect(rooms.some((r) => meets(r, pad!))).toBe(false);
    // Nearer the stage than the gate's Directory.
    const [directory] = of('directory');
    expect(pad!.y - (stage!.y + stage!.height)).toBeLessThan(directory!.y - pad!.y);
  });

  it('serves food from three stalls down the left, each a tent with a counter and four stools', () => {
    const stalls = ['Pizza Stall', 'Taco Stall', 'Coffee Stall'].map(room);
    const [stage] = of('stage');
    for (const stall of stalls) {
      expect(stall, 'stall').toBeDefined();
      expect(stall.x + stall.width, stall.label).toBeLessThan(stage!.x);
      const within = all.filter((e) => e !== stall && inside(e, stall));
      expect(
        within.filter((e) => e.shape === 'bar'),
        stall.label,
      ).toHaveLength(1);
      expect(
        within.filter((e) => e.shape === 'bar-stool'),
        stall.label,
      ).toHaveLength(4);
    }
    const kit = (name: string, shape: string) =>
      all.some((e) => e.shape === shape && inside(e, room(name)));
    expect(kit('Pizza Stall', 'kitchen-counter')).toBe(true);
    expect(kit('Taco Stall', 'drinks-fridge')).toBe(true);
    expect(kit('Coffee Stall', 'coffee-machine')).toBe(true);
    // Picnic tables to eat at on the lane's side of the field.
    expect(of('picnic-table').length).toBeGreaterThanOrEqual(2);
  });

  it('pours drinks in the Bar Tent on the right, with a campfire area of four benches below it', () => {
    const tent = room('Bar Tent');
    const [stage] = of('stage');
    expect(tent.x).toBeGreaterThan(stage!.x + stage!.width);
    for (const shape of ['bar', 'jukebox', 'sofa', 'drinks-fridge'])
      expect(
        all.some((e) => e.shape === shape && inside(e, tent)),
        shape,
      ).toBe(true);
    const [fire] = of('campfire');
    expect(of('campfire')).toHaveLength(1);
    expect(fire!.y).toBeGreaterThan(tent.y + tent.height);
    expect(fire!.x).toBeGreaterThan(tent.x - 100);
    const near = of('bench').filter(
      (b) => Math.hypot(centre(b).x - centre(fire!).x, centre(b).y - centre(fire!).y) < 260,
    );
    expect(near).toHaveLength(4);
    expect(of('hammock').length).toBeGreaterThan(0);
  });
});
