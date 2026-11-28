import { describe, expect, it } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { template3dFit, type FitRule } from './template-3d-fit';
import { flushToWalls } from './template-flush';
import { modelFloorBox } from './template-model-box';
import type { TemplateKind } from './templates';

// docs/specs/007-editor/templates-by-mode.md "Made for 3D": every tab of a template passes the layout check, judged
// where the 3D view stands each piece.

const at = (
  kind: string,
  x: number,
  y: number,
  more: Partial<ShapeElement> = {},
): ShapeElement => ({ ...createShape(kind as ShapeElement['shape'], x, y), ...more });
const room = (x: number, y: number, width: number, height: number, label = 'Room') =>
  at('room', x, y, { width, height, label, roomDoor: 'none' });
// A 600 x 400 room, its Door in the front wall, the Avatar Pad inside: passes on its own.
const base = (): Element[] => [
  room(0, 0, 600, 400),
  at('door', 252, 383),
  at('avatar-pad', 236, 230),
];
const rules = (els: Element[]): FitRule[] => template3dFit(els).map((i) => i.rule);

describe('template3dFit', () => {
  it('passes an empty room with a door and a pad', () => {
    expect(template3dFit(base())).toEqual([]);
  });

  it('flags a fridge stood out in the floor, and passes it once flushed to the back wall', () => {
    const els = [...base(), at('fridge', 260, 60)];
    expect(rules(els)).toContain('wall');
    const flushed = flushToWalls(els);
    expect(rules(flushed)).not.toContain('wall');
    const fridge = flushed.find((e) => e.type === 'shape' && e.shape === 'fridge') as ShapeElement;
    // Its model's back on the back wall's face: the line 31 px in, plus half the wall.
    expect(modelFloorBox(fridge).y).toBeCloseTo(31 + 4 + 1, 6);
  });

  it('flags a chair at a table facing away from it', () => {
    const table = at('meeting-table', 180, 120);
    const chair = at('chair', 200, 120 + table.height + 4, { chairFacing: 's' });
    expect(rules([...base(), table, chair])).not.toContain('facing');
    expect(rules([...base(), table, { ...chair, chairFacing: 'n' }])).toContain('facing');
  });

  it('flags two pieces standing on each other and a piece in the doorway', () => {
    expect(rules([...base(), at('plant', 100, 100), at('plant', 120, 110)])).toContain('overlap');
    expect(rules([...base(), at('plant', 270, 330)])).toContain('overlap');
  });

  it('flags a desk no walk reaches', () => {
    const desk = at('desk', 240, 140, { chairFacing: 'n' });
    expect(rules([...base(), desk])).not.toContain('reach');
    // The same desk in a room with no way in, a corridor's width from the first.
    const shut = room(800, 0, 600, 400, 'Shut');
    expect(rules([...base(), shut, { ...desk, x: desk.x + 800 }])).toContain('reach');
  });

  it('flags two rooms a double wall apart, and passes rooms that share one wall', () => {
    const left = room(0, 0, 400, 300, 'A');
    const door = (x: number) => at('door', x, 283);
    const pad = at('avatar-pad', 100, 150);
    expect(rules([left, room(390, 0, 400, 300, 'B'), door(150), door(540), pad])).not.toContain(
      'shared-wall',
    );
    expect(rules([left, room(430, 0, 400, 300, 'B'), door(150), door(580), pad])).toContain(
      'shared-wall',
    );
  });
});

// The templates rebuilt for 3D (the owner, 2026-11-27: "items against walls, facing the right way etc, not too tight
// spaces"), every floor of each.
const REBUILT: readonly TemplateKind[] = [
  'virtual-office',
  'coworking-space',
  'team-pod',
  'all-hands-hall',
  'focus-library',
  'interview-suite',
  'client-lounge',
  'document-room',
  'company-campus',
  'conference-venue',
  'startup-hq',
  'school-quad',
  'coworking-tower',
  'hotel-and-suites',
];
const TABS: [string, () => Element[]][] = REBUILT.flatMap((kind) => [
  [kind, () => buildTemplate(kind, 0, 0)] as [string, () => Element[]],
  ...templateFloors(kind).map(
    (f) => [`${kind} ${f.name}`, () => f.build(0, 0)] as [string, () => Element[]],
  ),
]);

describe.each(TABS)('the %s tab, made for 3D', (_name, build) => {
  it('passes the layout check', () => {
    expect(template3dFit(build()).map((i) => `[${i.rule}] ${i.message}`)).toEqual([]);
  });
});

it('checks a tab well inside a frame budget', () => {
  // CPU time on the largest tab, measured at 2 to 40 ms; 400 ms leaves room for a slow CI runner.
  const els = buildTemplate('company-campus', 0, 0);
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) template3dFit(els);
  expect((performance.now() - t0) / 3).toBeLessThan(400);
});

it('flags an indoor chair out on the lawn, and passes a bench there and a chair in the room', () => {
  const lawn = at('grass', -800, -200, { width: 1600, height: 1000 });
  expect(rules([lawn, ...base(), at('chair', 700, 100)])).toContain('indoor');
  const ok = template3dFit([lawn, ...base(), at('bench', 700, 100)]).filter(
    (i) => i.rule === 'indoor',
  );
  expect(ok).toEqual([]);
  // A building's open floor, with no lawn or path, is indoors all over.
  expect(rules([...base(), at('chair', 700, 100)])).not.toContain('indoor');
});

describe('outdoor: roads lie out of doors (docs/specs/009-elements/road.md)', () => {
  const road = (x: number, y: number) =>
    ({ id: `road-${x}`, type: 'shape', shape: 'road', x, y, width: 480, height: 136 }) as Element;
  const room = {
    id: 'r',
    type: 'shape',
    shape: 'room',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  } as Element;
  it('flags a road whose middle lies in a room', () => {
    const issues = template3dFit([room, road(100, 200)]).filter((i) => i.rule === 'outdoor');
    expect(issues).toHaveLength(1);
  });
  it('passes a road out of doors', () => {
    expect(template3dFit([room, road(100, 900)]).filter((i) => i.rule === 'outdoor')).toEqual([]);
  });
});
