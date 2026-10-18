import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './element-types';
import { fittedEntityHeight } from './entity-fields';
import { entityRowTop, snapToEntityField } from './entity-geometry';
import { buildRelatedEntity, RELATED_ENTITY_GAP_PX } from './entity-related';
import { endpointPosition } from './geometry';

// docs/specs/009-elements/entity.md "Growing a model" and "Field to field".

const source = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'src',
  type: 'shape',
  shape: 'entity',
  x: 0,
  y: 0,
  width: 240,
  height: fittedEntityHeight(2, {}),
  label: 'Customer',
  colorPreset: 'soft',
  entityFields: [
    { name: 'id', type: 'uuid', key: 'pk' },
    { name: 'name', type: 'text' },
  ],
  ...over,
});

describe('buildRelatedEntity', () => {
  it('puts the new entity beside the source, its foreign key level with the primary key', () => {
    const src = source();
    const { entity, arrow } = buildRelatedEntity(src, 'right', [src]);
    expect(entity.x).toBe(src.width + RELATED_ENTITY_GAP_PX);
    expect(entity.width).toBe(src.width);
    expect(entity.colorPreset).toBe('soft');
    expect(entity.label).toBe('Entity');
    expect(entity.entityFields).toEqual([
      { name: 'id', type: 'uuid', key: 'pk' },
      { name: 'customer_id', type: 'uuid', key: 'fk' },
    ]);
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: 'src', anchor: 'e', field: 0 });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: entity.id, anchor: 'w', field: 1 });
    expect(arrow).toMatchObject({
      arrowEnds: 'both',
      arrowheadStartShape: 'one',
      arrowheadShape: 'many',
    });
    // Straight: both field ends at one height.
    const els = [src, entity];
    expect(endpointPosition(arrow.from, els).y).toBeCloseTo(endpointPosition(arrow.to, els).y, 5);
    expect(entityRowTop(entity, 1)).toBeCloseTo(entityRowTop(src, 0), 5);
  });

  it('joins box to box above and below, centred', () => {
    const src = source();
    const { entity, arrow } = buildRelatedEntity(src, 'below', [src]);
    expect(entity.y).toBe(src.height + RELATED_ENTITY_GAP_PX);
    expect(entity.x).toBe(src.x);
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: 'src', anchor: 's' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: entity.id, anchor: 'n' });
    const above = buildRelatedEntity(src, 'above', [src]);
    expect(above.entity.y + above.entity.height).toBe(-RELATED_ENTITY_GAP_PX);
  });

  it('steps past whatever is in the way', () => {
    const src = source();
    const blocker = source({ id: 'b', x: src.width + RELATED_ENTITY_GAP_PX, y: -20 });
    const { entity } = buildRelatedEntity(src, 'right', [src, blocker]);
    expect(entity.x).toBe(2 * (src.width + RELATED_ENTITY_GAP_PX));
    const left = buildRelatedEntity(src, 'left', [src]);
    expect(left.entity.x).toBe(-RELATED_ENTITY_GAP_PX - src.width);
  });

  it('starts from the title when the source has no primary key', () => {
    const src = source({ entityFields: [{ name: 'note' }] });
    const { arrow } = buildRelatedEntity(src, 'left', [src]);
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: 'src', anchor: 'w' });
  });
});

describe('snapToEntityField', () => {
  const a = source();
  const b = source({ id: 'b', x: 400 });

  it('pins to the field under the cursor, on the side facing the other end', () => {
    const snap = snapToEntityField(
      { x: 450, y: entityRowTop(b, 1) + 4 },
      [a, b],
      { x: 100, y: 0 },
      'src',
    );
    expect(snap).toMatchObject({ elementId: 'b', anchor: 'w', field: 1 });
    expect(snap!.point.x).toBe(400);
    const fromRight = snapToEntityField(
      { x: 450, y: entityRowTop(b, 0) + 4 },
      [a, b],
      { x: 2000, y: 0 },
      null,
    );
    expect(fromRight).toMatchObject({ anchor: 'e', field: 0 });
  });

  it('offers nothing over a title, off any entity, or on the entity the arrow starts from', () => {
    expect(snapToEntityField({ x: 450, y: 10 }, [a, b], { x: 0, y: 0 }, null)).toBeNull();
    expect(snapToEntityField({ x: 300, y: 40 }, [a, b], { x: 0, y: 0 }, null)).toBeNull();
    expect(
      snapToEntityField({ x: 450, y: entityRowTop(b, 1) + 4 }, [a, b], { x: 0, y: 0 }, 'b'),
    ).toBeNull();
  });

  it('lets the topmost entity decide', () => {
    const over = source({ id: 'top', x: 400, y: 0, entityFields: [] });
    expect(
      snapToEntityField({ x: 450, y: entityRowTop(b, 1) + 4 }, [a, b, over], { x: 0, y: 0 }, null),
    ).toBeNull();
  });
});
