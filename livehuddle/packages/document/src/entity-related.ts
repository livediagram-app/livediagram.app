// Add Related Entity (docs/specs/009-elements/entity.md "Growing a model: the quick-connect ring"): a new
// entity on one side of a source, already joined to it, laid out and wired here so the editor only commits
// what this returns. Pure.

import type { ArrowElement } from './arrow-types';
import {
  cardinalityPatch,
  CARDINALITY_PRESETS,
  fittedEntityHeight,
  primaryKeyIndex,
  relatedEntityFields,
} from './entity-fields';
import { entityRowTop } from './entity-geometry';
import type { ShapeElement } from './element-types';
import { createShape } from './shape-factory';
import { isBoxed, type Element } from './index';

export type RelatedSide = 'right' | 'left' | 'above' | 'below';

// The clear space between the source and the new entity: room for the crow's feet and a label.
export const RELATED_ENTITY_GAP_PX = 120;
// How many further steps out the new entity takes to find clear canvas before settling where it is.
const MAX_STEPS = 12;

// The source's look the new entity copies, so a model grows in one style.
const LOOK_KEYS = [
  'width',
  'textSize',
  'colorPreset',
  'fillColor',
  'strokeColor',
  'textColor',
  'headerFill',
  'finish',
  'borderRadius',
  'strokeWidth',
  'strokeStyle',
  'layerId',
] as const satisfies readonly (keyof ShapeElement)[];

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export function buildRelatedEntity(
  source: ShapeElement,
  side: RelatedSide,
  elements: readonly Element[],
): { entity: ShapeElement; arrow: ArrowElement } {
  const look: Partial<ShapeElement> = {};
  for (const key of LOOK_KEYS) {
    if (source[key] !== undefined) (look as Record<string, unknown>)[key] = source[key];
  }
  const fields = relatedEntityFields(source);
  // The factory's own text size gives way to the source's, absent included, so the two draw alike.
  const { textSize: _factorySize, ...base } = createShape('entity', 0, 0);
  const width = source.width;
  const height = fittedEntityHeight(fields.length, look);
  const horizontal = side === 'left' || side === 'right';

  // Beside the source, its foreign key field level with the source's primary key field, so the line
  // between them runs straight; above or below, centred on it.
  const pk = primaryKeyIndex(source.entityFields ?? []);
  const sourceRowY = entityRowTop(source, Math.max(0, pk));
  // The new foreign key field's top, from the new entity's top.
  const rowOffset = entityRowTop({ x: 0, y: 0, width, height, textSize: look.textSize }, 1);
  let x =
    side === 'right'
      ? source.x + source.width + RELATED_ENTITY_GAP_PX
      : side === 'left'
        ? source.x - RELATED_ENTITY_GAP_PX - width
        : source.x + (source.width - width) / 2;
  let y = horizontal
    ? sourceRowY - rowOffset
    : side === 'below'
      ? source.y + source.height + RELATED_ENTITY_GAP_PX
      : source.y - RELATED_ENTITY_GAP_PX - height;
  // Step further out while it would land on something.
  const step = horizontal ? width + RELATED_ENTITY_GAP_PX : height + RELATED_ENTITY_GAP_PX;
  for (let i = 0; i < MAX_STEPS; i++) {
    const box = { x, y, width, height };
    if (!elements.some((el) => el.id !== source.id && isBoxed(el) && overlaps(box, el))) break;
    if (side === 'right') x += step;
    else if (side === 'left') x -= step;
    else if (side === 'below') y += step;
    else y -= step;
  }

  const entity: ShapeElement = {
    ...base,
    ...look,
    x,
    y,
    width,
    height,
    label: 'Entity',
    entityFields: fields,
  };

  // Beside: source primary key field to the new foreign key field. Above or below: box to box, the
  // field ends being for the left and right edges.
  const out = { right: 'e', left: 'w', below: 's', above: 'n' } as const;
  const into = { right: 'w', left: 'e', below: 'n', above: 's' } as const;
  const oneToMany = CARDINALITY_PRESETS.find((p) => p.id === 'one-to-many')!;
  const arrow: ArrowElement = {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: {
      kind: 'pinned',
      elementId: source.id,
      anchor: out[side],
      ...(horizontal && pk >= 0 ? { field: pk } : {}),
    },
    to: {
      kind: 'pinned',
      elementId: entity.id,
      anchor: into[side],
      ...(horizontal ? { field: 1 } : {}),
    },
    ...cardinalityPatch(oneToMany),
    ...(source.layerId ? { layerId: source.layerId } : {}),
  };
  return { entity, arrow };
}
