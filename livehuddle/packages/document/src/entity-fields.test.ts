import { describe, expect, it, vi } from 'vitest';
import type { ArrowElement } from './arrow-types';
import { rebindArrowAnchorsAfterMove } from './arrow-rebind';
import type { ShapeElement } from './element-types';
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
  joinsEntities,
  nextEntityKey,
  relatedEntityFields,
  relationshipHeads,
  removedFieldRemap,
  withEntityFields,
} from './entity-fields';
import {
  ENTITY_KEY_GUTTER_PX,
  ENTITY_KEY_PAIR_GUTTER_PX,
  entityFieldPoint,
  entityPartAt,
  entityRowTop,
} from './entity-geometry';
import { endpointPosition } from './geometry';
import type { Element } from './index';
import { svgEntityRows } from './svg-render-entity';
import { elementValidationIssue } from './validate';

// docs/specs/009-elements/entity.md: keys, the box following its fields, field-to-field relationships and
// their cardinality ends.

const entity = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'e1',
  type: 'shape',
  shape: 'entity',
  x: 0,
  y: 0,
  width: 200,
  height: fittedEntityHeight(3, {}),
  label: 'Customer',
  entityFields: [
    { name: 'id', type: 'uuid', key: 'pk' },
    { name: 'email', type: 'text', key: 'uk' },
    { name: 'org_id', type: 'uuid', key: 'fk' },
  ],
  ...over,
});

const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a1',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'e1', anchor: 'e', field: 0 },
  to: { kind: 'pinned', elementId: 'e2', anchor: 'w', field: 1 },
  ...over,
});

describe('keys', () => {
  it('cycles none, PK, FK, PK FK, UK, none', () => {
    const seen = [];
    let key = nextEntityKey(undefined);
    while (key) {
      seen.push(key);
      key = nextEntityKey(key);
    }
    expect(seen).toEqual(['pk', 'fk', 'pk-fk', 'uk']);
  });

  it('reads marker words as one key, primary first', () => {
    expect(entityKeyOf(['PK', 'FK'])).toBe('pk-fk');
    expect(entityKeyOf(['fk'])).toBe('fk');
    expect(entityKeyOf(['UK', 'PK'])).toBe('pk');
    expect(entityKeyOf(['UK'])).toBe('uk');
    expect(entityKeyOf([])).toBeUndefined();
  });

  it('reads a legacy type text as a key and a type without it', () => {
    expect(entityFieldView({ name: 'id', type: 'uuid PK' })).toEqual({
      name: 'id',
      type: 'uuid',
      key: 'pk',
    });
    expect(entityFieldView({ name: 'c', type: 'uuid FK, null' })).toEqual({
      name: 'c',
      type: 'uuid, null',
      key: 'fk',
    });
    expect(entityFieldView({ name: 'o', type: 'PK FK' })).toEqual({ name: 'o', key: 'pk-fk' });
    expect(entityFieldView({ name: 'x', type: 'uuid PK FK' }).key).toBe('pk-fk');
  });

  it('leaves a field alone when it has its own key or no key words', () => {
    const own = { name: 'id', type: 'uuid PK', key: 'uk' as const };
    expect(entityFieldView(own)).toBe(own);
    const plain = { name: 'pkg', type: 'packaging' };
    expect(entityFieldView(plain)).toBe(plain);
  });

  it('opens the gutter only for keys, wider for a PK FK pair', () => {
    expect(entityKeyGutterPx([{ name: 'a' }])).toBe(0);
    expect(entityKeyGutterPx([{ name: 'a', key: 'uk' }])).toBe(ENTITY_KEY_GUTTER_PX);
    expect(entityKeyGutterPx([{ name: 'a', type: 'uuid PK FK' }])).toBe(ENTITY_KEY_PAIR_GUTTER_PX);
  });
});

describe('cleanEntityFields', () => {
  it('bounds the rows and stores a blank type and no key as absent', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ name: `f${i}` }));
    expect(cleanEntityFields(many)).toHaveLength(40);
    expect(cleanEntityFields([{ name: 'x'.repeat(90), type: '   ' }])).toEqual([
      { name: 'x'.repeat(80) },
    ]);
    expect(
      cleanEntityFields([
        { name: 'a', type: ' int ', key: 'bogus' as never },
        { name: 'b', key: 'fk' },
      ]),
    ).toEqual([
      { name: 'a', type: 'int' },
      { name: 'b', key: 'fk' },
    ]);
  });
});

describe('withEntityFields', () => {
  it('fits the box to its fields, keeping any extra height', () => {
    const fitted = entity();
    const grown = withEntityFields([fitted], 'e1', [...fitted.entityFields!, { name: 'new' }]);
    expect((grown[0] as ShapeElement).height).toBe(fittedEntityHeight(4, fitted));
    const roomy = entity({ height: fittedEntityHeight(3, {}) + 40 });
    const out = withEntityFields([roomy], 'e1', [{ name: 'only' }]);
    expect((out[0] as ShapeElement).height).toBe(fittedEntityHeight(1, roomy) + 40);
  });

  it('grows a clipped box to show every field', () => {
    const clipped = entity({ height: 40 });
    const out = withEntityFields([clipped], 'e1', clipped.entityFields!);
    expect((out[0] as ShapeElement).height).toBe(fittedEntityHeight(3, clipped));
  });

  it('lets go of an end on a removed field and moves the later ones up', () => {
    const els: Element[] = [
      entity(),
      arrow({ from: { kind: 'pinned', elementId: 'e1', anchor: 'e', field: 1 } }),
      arrow({ id: 'a2', from: { kind: 'pinned', elementId: 'e1', anchor: 'w', field: 2 } }),
      arrow({ id: 'a3', from: { kind: 'pinned', elementId: 'e1', anchor: 'w', field: 0 } }),
    ];
    const fields = entity().entityFields!.filter((_, i) => i !== 1);
    const out = withEntityFields(els, 'e1', fields, removedFieldRemap(1));
    expect((out[1] as ArrowElement).from).toEqual({ kind: 'pinned', elementId: 'e1', anchor: 'e' });
    expect((out[2] as ArrowElement).from).toMatchObject({ field: 1 });
    expect(out[3]).toBe(els[3]);
  });

  it('moves ends down past an inserted field', () => {
    const els: Element[] = [entity(), arrow()];
    const out = withEntityFields(
      els,
      'e1',
      [{ name: 'new' }, ...entity().entityFields!],
      insertedFieldRemap(0),
    );
    expect((out[1] as ArrowElement).from).toMatchObject({ field: 1 });
  });
});

describe('field-to-field geometry', () => {
  it('meets the left or right edge level with the field row', () => {
    const el = entity({ x: 100, y: 50 });
    const p = entityFieldPoint(el, 'e', 1, 3)!;
    expect(p.x).toBe(300);
    expect(p.y).toBeGreaterThan(entityRowTop(el, 1));
    expect(p.y).toBeLessThan(entityRowTop(el, 2));
    expect(entityFieldPoint(el, 'w', 0, 3)!.x).toBe(100);
  });

  it('falls back when the field is past the last one or below the box', () => {
    const el = entity();
    expect(entityFieldPoint(el, 'e', 3, 3)).toBeNull();
    expect(entityFieldPoint(el, 'e', -1, 3)).toBeNull();
    expect(entityFieldPoint({ ...el, height: 40 }, 'e', 2, 3)).toBeNull();
  });

  it('resolves a pinned end to its field, and to the plain anchor otherwise', () => {
    const els: Element[] = [entity()];
    const onField = endpointPosition(
      { kind: 'pinned', elementId: 'e1', anchor: 'e', field: 2 },
      els,
    );
    expect(onField.y).toBeCloseTo(entityRowTop(entity(), 2) + 13.75 / 2, 5);
    const top = endpointPosition({ kind: 'pinned', elementId: 'e1', anchor: 'n', field: 2 }, els);
    expect(top).toEqual(endpointPosition({ kind: 'pinned', elementId: 'e1', anchor: 'n' }, els));
    const square: Element = { ...entity(), shape: 'square' };
    expect(
      endpointPosition({ kind: 'pinned', elementId: 'e1', anchor: 'e', field: 2 }, [square]).y,
    ).toBe(square.height / 2);
  });

  it('turns a field end with the element', () => {
    const el = entity({ rotation: 180 });
    const p = endpointPosition({ kind: 'pinned', elementId: 'e1', anchor: 'e', field: 0 }, [el]);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(el.height - (entityRowTop(el, 0) + 13.75 / 2), 5);
  });

  it('finds the part of the box under a point', () => {
    const el = entity();
    expect(entityPartAt(el, 3, { x: 10, y: 10 })).toEqual({ kind: 'title' });
    expect(entityPartAt(el, 3, { x: 10, y: entityRowTop(el, 1) + 5 })).toEqual({
      kind: 'field',
      index: 1,
    });
    expect(
      entityPartAt({ ...el, height: el.height + 60 }, 3, { x: 10, y: el.height + 30 }),
    ).toEqual({
      kind: 'below',
    });
    expect(entityPartAt(el, 3, { x: -1, y: 40 })).toBeNull();
  });

  it('keeps a field end on its field when a move swaps its side', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const a = entity();
    const b = entity({ id: 'e2', x: -500 });
    const rel = arrow();
    const out = rebindArrowAnchorsAfterMove([a, b, rel], new Set(['e2']));
    const moved = out[2] as ArrowElement;
    expect(moved.from).toEqual({ kind: 'pinned', elementId: 'e1', anchor: 'w', field: 0 });
    expect(moved.to).toEqual({ kind: 'pinned', elementId: 'e2', anchor: 'e', field: 1 });
  });
});

describe('relationships', () => {
  const two = (over: Partial<ArrowElement> = {}): Element[] => [
    entity(),
    entity({ id: 'e2', x: 400 }),
    arrow(over),
  ];

  it('makes the end on a foreign key the many end', () => {
    const els = two({
      from: { kind: 'pinned', elementId: 'e1', anchor: 'e', field: 2 },
      to: { kind: 'pinned', elementId: 'e2', anchor: 'w', field: 0 },
    });
    expect(relationshipHeads(els[2] as ArrowElement, els)).toEqual({
      arrowEnds: 'both',
      arrowheadStartShape: 'many',
      arrowheadShape: 'one',
    });
  });

  it('runs one to many from where it was drawn without a foreign key', () => {
    const els = two();
    expect(relationshipHeads(els[2] as ArrowElement, els)).toMatchObject({
      arrowheadStartShape: 'one',
      arrowheadShape: 'many',
    });
  });

  it('leaves an arrow with its own heads, or not between two entities', () => {
    const els = two({ arrowheadShape: 'diamond' });
    expect(relationshipHeads(els[2] as ArrowElement, els)).toBeNull();
    const loose = two({ to: { kind: 'free', x: 0, y: 0 } });
    expect(relationshipHeads(loose[2] as ArrowElement, loose)).toBeNull();
    expect(joinsEntities(loose[2] as ArrowElement, loose)).toBe(false);
    expect(joinsEntities(els[2] as ArrowElement, els)).toBe(true);
  });

  it('labels the pair each preset sets', () => {
    for (const preset of CARDINALITY_PRESETS) {
      expect(cardinalityLabel({ ...arrow(), ...cardinalityPatch(preset) })).toBe(preset.short);
    }
    expect(cardinalityLabel(arrow())).toBeNull();
    expect(
      cardinalityLabel({ ...arrow(), arrowEnds: 'both', arrowheadShape: 'triangle' }),
    ).toBeNull();
  });
});

describe('Add Related Entity', () => {
  it('names the foreign key after the source, singular and snake case', () => {
    expect(foreignKeyName('Customer')).toBe('customer_id');
    expect(foreignKeyName('customers')).toBe('customer_id');
    expect(foreignKeyName('Order line')).toBe('order_line_id');
    expect(foreignKeyName('OrderLine')).toBe('order_line_id');
    expect(foreignKeyName('Café')).toBe('cafe_id');
    expect(foreignKeyName('Address')).toBe('address_id');
    expect(foreignKeyName('Status')).toBe('status_id');
    expect(foreignKeyName('Order status')).toBe('order_status_id');
    expect(foreignKeyName('Analysis')).toBe('analysis_id');
    expect(foreignKeyName('Categories')).toBe('category_id');
    expect(foreignKeyName('Addresses')).toBe('address_id');
    expect(foreignKeyName('Boxes')).toBe('box_id');
    expect(foreignKeyName('Matches')).toBe('match_id');
    expect(foreignKeyName('Keys')).toBe('key_id');
    expect(foreignKeyName('Shoes')).toBe('shoe_id');
    expect(foreignKeyName('')).toBe('parent_id');
  });

  it("types both new keys like the source's primary key", () => {
    expect(relatedEntityFields(entity({ label: 'Customer' }))).toEqual([
      { name: 'id', type: 'uuid', key: 'pk' },
      { name: 'customer_id', type: 'uuid', key: 'fk' },
    ]);
    expect(
      relatedEntityFields(entity({ entityFields: [{ name: 'id', type: 'bigint PK' }] }))[1],
    ).toEqual({
      name: 'customer_id',
      type: 'bigint',
      key: 'fk',
    });
    expect(relatedEntityFields(entity({ entityFields: [] }))[0]!.type).toBe('uuid');
  });
});

describe('validation', () => {
  it('accepts a key and a field end, and refuses bad ones', () => {
    expect(elementValidationIssue(entity())).toBeNull();
    expect(
      elementValidationIssue(entity({ entityFields: [{ name: 'a', key: 'primary' as never }] })),
    ).not.toBeNull();
    expect(elementValidationIssue(arrow())).toBeNull();
    for (const field of [-1, 1.5, 40]) {
      expect(
        elementValidationIssue(
          arrow({ from: { kind: 'pinned', elementId: 'e1', anchor: 'e', field } }),
        ),
      ).not.toBeNull();
    }
  });
});

describe('export', () => {
  it('draws the band, a stripe, the key glyphs and the monospace types', () => {
    const svg = svgEntityRows(entity(), { textColor: '#111111', stroke: '#336699' });
    expect(svg).toContain('fill="#336699" opacity="0.12"');
    expect(svg).toContain('#f59e0b');
    expect(svg).toContain('ui-monospace');
    expect(svg).toContain('font-weight="600"');
    expect(svg.match(/<rect /g)!.length).toBeGreaterThanOrEqual(3);
  });

  it('paints a set heading colour at full strength and skips rows below the box', () => {
    const svg = svgEntityRows(entity({ headerFill: '#fecdd3', height: 50 }), {
      textColor: '#111',
      stroke: '#000',
    });
    expect(svg).toContain('fill="#fecdd3"/>');
    expect(svg).not.toContain('org_id');
  });
});
