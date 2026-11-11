import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement } from './element';
import {
  CARDINALITY_PRESETS,
  cardinalityLabel,
  cardinalityPatch,
  cleanEntityFields,
  entityFieldView,
  entityKeyGutterPx,
  entityKeyOf,
  fittedEntityHeight,
  foreignKeyName,
  insertedFieldRemap,
  isEntity,
  isForeignKey,
  isPrimaryKey,
  joinsEntities,
  nextEntityKey,
  relatedEntityFields,
  relationshipHeads,
  removedFieldRemap,
  withEntityFields,
  withRelationshipHeads,
} from './entity-fields';
import { entityKeyGlyphs } from './entity-look';
import { svgEntityRows } from './svg-render-entity';
import { createShape } from './testing/elements';

// docs/specs/009-elements/entity.md. Each product's entity tests also read its validator, rebinding and canvas
// geometry through the bindings; these read the shared rules alone.
const entity = (id: string, fields: ShapeElement['entityFields'] = []): ShapeElement => ({
  ...createShape('entity', 0, 0),
  id,
  label: 'Orders',
  entityFields: fields,
});
const pinned = (id: string, fromField?: number, toField?: number): ArrowElement => ({
  id,
  type: 'arrow',
  from: {
    kind: 'pinned',
    elementId: 'a',
    anchor: 'e',
    ...(fromField !== undefined ? { field: fromField } : {}),
  },
  to: {
    kind: 'pinned',
    elementId: 'b',
    anchor: 'w',
    ...(toField !== undefined ? { field: toField } : {}),
  },
});

describe('keys', () => {
  it('cycles through the keys and back to none', () => {
    expect(nextEntityKey(undefined)).toBe('pk');
    expect(nextEntityKey('pk')).toBe('fk');
    expect(nextEntityKey('uk')).toBeUndefined();
  });

  it('reads key markers in any case', () => {
    expect(entityKeyOf(['pk', 'FK'])).toBe('pk-fk');
    expect(entityKeyOf(['PK'])).toBe('pk');
    expect(entityKeyOf(['fk'])).toBe('fk');
    expect(entityKeyOf(['uk'])).toBe('uk');
    expect(entityKeyOf(['nn'])).toBeUndefined();
  });

  it('reads a legacy key word in the type as its key', () => {
    expect(entityFieldView({ name: 'id', type: 'uuid PK' })).toEqual({
      name: 'id',
      type: 'uuid',
      key: 'pk',
    });
    expect(entityFieldView({ name: 'x', type: 'PK, FK' })).toEqual({ name: 'x', key: 'pk-fk' });
    const plain = { name: 'n', type: 'text' };
    expect(entityFieldView(plain)).toBe(plain);
    const keyed = { name: 'n', type: 'PK', key: 'fk' as const };
    expect(entityFieldView(keyed)).toBe(keyed);
  });

  it('sizes the key gutter by the widest key, and tells primary from foreign', () => {
    expect(entityKeyGutterPx([{ name: 'a' }])).toBe(0);
    const one = entityKeyGutterPx([{ name: 'a', key: 'pk' }]);
    const pair = entityKeyGutterPx([
      { name: 'a', key: 'pk' },
      { name: 'b', key: 'pk-fk' },
    ]);
    expect(one).toBeGreaterThan(0);
    expect(pair).toBeGreaterThan(one);
    expect(isForeignKey({ name: 'a', key: 'pk-fk' })).toBe(true);
    expect(isForeignKey(undefined)).toBe(false);
    expect(isPrimaryKey({ name: 'a', key: 'pk' })).toBe(true);
    expect(isPrimaryKey({ name: 'a', key: 'fk' })).toBe(false);
  });

  it('draws one glyph per key, two for a key that is both', () => {
    expect(entityKeyGlyphs('pk')).toEqual(['key']);
    expect(entityKeyGlyphs('fk')).toEqual(['link']);
    expect(entityKeyGlyphs('pk-fk')).toEqual(['key', 'link']);
    expect(entityKeyGlyphs('uk')).toEqual(['unique']);
  });
});

describe('withEntityFields', () => {
  it('cleans the fields, refits the box keeping its slack, and follows a moved field', () => {
    const a = entity('a', [{ name: 'id' }, { name: 'name' }]);
    a.height = fittedEntityHeight(2, a) + 10;
    const elements: Element[] = [a, entity('b'), pinned('r', 1)];
    const out = withEntityFields(
      elements,
      'a',
      [{ name: 'name', type: '  text  ', key: 'zz' as 'pk' }],
      removedFieldRemap(0),
    );
    const next = out[0] as ShapeElement;
    expect(next.entityFields).toEqual([{ name: 'name', type: 'text' }]);
    expect(next.height).toBe(fittedEntityHeight(1, next) + 10);
    expect(out[1]).toBe(elements[1]);
    expect((out[2] as ArrowElement).from).toMatchObject({ field: 0 });
  });

  it('drops the field from an end whose field was removed, and leaves other ends', () => {
    const elements: Element[] = [entity('a', [{ name: 'id' }]), pinned('r', 0), pinned('s')];
    const out = withEntityFields(elements, 'a', [], removedFieldRemap(0));
    expect((out[1] as ArrowElement).from).not.toHaveProperty('field');
    expect(out[2]).toBe(elements[2]);
    expect(insertedFieldRemap(1)(0)).toBe(0);
    expect(insertedFieldRemap(1)(1)).toBe(2);
  });

  it('cuts the fields to their limits', () => {
    const long = 'x'.repeat(200);
    const [f] = cleanEntityFields([{ name: long, type: long }]);
    expect(f!.name.length).toBeLessThan(200);
    expect(f!.type!.length).toBeLessThan(200);
  });
});

describe('relationships', () => {
  const elements = (): Element[] => [
    entity('a', [{ name: 'id', key: 'pk' }]),
    entity('b', [{ name: 'order_id', key: 'fk' }]),
  ];

  it('gives a join its crow feet: many on the foreign key end', () => {
    expect(relationshipHeads(pinned('r', 0, 0), elements())).toEqual({
      arrowEnds: 'both',
      arrowheadStartShape: 'one',
      arrowheadShape: 'many',
    });
    const reversed: Element[] = [
      entity('a', [{ name: 'x', key: 'fk' }]),
      entity('b', [{ name: 'id' }]),
    ];
    expect(relationshipHeads(pinned('r', 0, 0), reversed)?.arrowheadStartShape).toBe('many');
    expect(relationshipHeads({ ...pinned('r'), arrowEnds: 'to' }, elements())).toBeNull();
    expect(relationshipHeads(pinned('r'), [entity('a')])).toBeNull();
  });

  it('joins only two entities', () => {
    expect(joinsEntities(pinned('r'), elements())).toBe(true);
    expect(
      joinsEntities(pinned('r'), [entity('a'), { ...createShape('square', 0, 0), id: 'b' }]),
    ).toBe(false);
  });

  it('labels and patches a cardinality', () => {
    const arrow = { ...pinned('r'), ...cardinalityPatch(CARDINALITY_PRESETS[1]!) };
    expect(cardinalityLabel(arrow)).toBe('1 : N');
    expect(cardinalityLabel({ ...pinned('r'), ...cardinalityPatch(CARDINALITY_PRESETS[3]!) })).toBe(
      'N : M',
    );
    expect(cardinalityLabel(pinned('r'))).toBeNull();
    expect(
      cardinalityLabel({ ...pinned('r'), arrowEnds: 'both', arrowheadShape: 'triangle' }),
    ).toBeNull();
  });

  it('sets the heads on one arrow, and leaves the list when none apply', () => {
    const list = [...elements(), pinned('r', 0, 0)];
    const out = withRelationshipHeads(list, 'r');
    expect((out[2] as ArrowElement).arrowEnds).toBe('both');
    expect(withRelationshipHeads(list, 'missing')).toBe(list);
  });

  it('names a foreign key after its table, and seeds a related entity', () => {
    expect(foreignKeyName('OrderItems')).toBe('order_item_id');
    expect(foreignKeyName('Categories')).toBe('category_id');
    expect(foreignKeyName('Boxes')).toBe('box_id');
    expect(foreignKeyName('Status')).toBe('status_id');
    expect(foreignKeyName('Café')).toBe('cafe_id');
    expect(foreignKeyName('')).toBe('parent_id');
    expect(relatedEntityFields(entity('a', [{ name: 'id', type: 'int', key: 'pk' }]))).toEqual([
      { name: 'id', type: 'int', key: 'pk' },
      { name: 'order_id', type: 'int', key: 'fk' },
    ]);
    expect(
      relatedEntityFields({ ...entity('a'), entityFields: undefined, label: undefined })[0]!.type,
    ).toBe('uuid');
  });

  it('knows an entity', () => {
    expect(isEntity(entity('a'))).toBe(true);
    expect(isEntity(undefined)).toBe(false);
  });
});

describe('svgEntityRows', () => {
  it('draws the band, a stripe on every other row, the keys and the muted types', () => {
    const el = {
      ...entity('e:1', [
        { name: 'id', type: 'uuid', key: 'pk' as const },
        { name: 'customer_id', key: 'fk' as const },
        { name: 'total', type: 'money' },
      ]),
      width: 220,
      height: 400,
      headerFill: '#ff0000',
    } as ShapeElement;
    const svg = svgEntityRows(el, { textColor: '#111111', stroke: '#222222' });
    expect(svg).toContain('<clipPath id="lvd-en-e1">');
    expect(svg).toContain('fill="#ff0000"/>');
    expect(svg).toContain('font-weight="600"');
    expect(svg).toContain('>uuid</text>');
    expect(svg).toContain('opacity="0.7"');
    expect(svg.match(/<rect /g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('stops at the rows the box has room for', () => {
    const el = { ...entity('e', [{ name: 'a' }, { name: 'b' }]), height: 1 } as ShapeElement;
    expect(
      svgEntityRows(el, { textColor: '#000', stroke: '#000', fontFamily: 'Inter' }),
    ).not.toContain('>a</text>');
  });
});
