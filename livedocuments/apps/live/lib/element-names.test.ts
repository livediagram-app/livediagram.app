import { describe, expect, it } from 'vitest';
import {
  createAnnotation,
  createFreehand,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livedocuments/document';
import {
  describeMany,
  describeOne,
  describeSelected,
  elementAriaLabel,
  elementRole,
  kindLabel,
  shapeKindLabel,
} from './element-names';

// Shared element naming (docs/specs/004-interface-design/canvas-accessibility.md): the canvas aria-labels /
// announcements and the other surfaces that name an element read the same
// names. These tests pin the formats they rely on.

const square = (label?: string) => ({ ...createShape('square', 0, 0), label });
const arrow = (label?: string) => ({
  id: 'ar',
  type: 'arrow' as const,
  from: { kind: 'free' as const, x: 0, y: 0 },
  to: { kind: 'free' as const, x: 10, y: 10 },
  label,
});

describe('kindLabel', () => {
  it('names shapes by their concrete sub-kind, others by type', () => {
    expect(kindLabel(square())).toBe('Square');
    expect(kindLabel(arrow())).toBe('Arrow');
    expect(kindLabel(createSticky(0, 0))).toBe('Sticky note');
    expect(kindLabel(createText(0, 0))).toBe('Text');
    expect(kindLabel(createAnnotation(0, 0))).toBe('Annotation');
  });

  it('names freehand variants by what the user drew', () => {
    const freehand = (extra: object) => ({
      ...createFreehand(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        false,
      ),
      ...extra,
    });
    expect(kindLabel(freehand({}))).toBe('Sketch');
    expect(kindLabel(freehand({ pen: 'highlighter' }))).toBe('Highlight');
    expect(kindLabel(freehand({ straightEdges: true }))).toBe('Polyline');
    expect(kindLabel(freehand({ straightEdges: true, closed: true }))).toBe('Polygon');
  });
});

describe('describeOne / describeMany', () => {
  it('prefers the quoted label, falls back to the articled kind', () => {
    expect(describeOne(square('Login'))).toBe("'Login'");
    expect(describeOne(square())).toBe('a Square');
    expect(describeOne(arrow('yes'))).toBe('an Arrow');
  });

  it('groups a mixed multi-selection by kind', () => {
    expect(describeMany([square(), square(), arrow()])).toBe('2 Squares & an Arrow');
  });
});

describe('elementAriaLabel', () => {
  it('leads with the kind, then the quoted label when present', () => {
    expect(elementAriaLabel(square('Login'))).toBe('Square "Login"');
    expect(elementAriaLabel(square('  '))).toBe('Square');
    expect(elementAriaLabel(arrow('yes'))).toBe('Arrow "yes"');
    expect(elementAriaLabel(createSticky(0, 0))).toBe('Sticky note');
  });
});

describe('a chart', () => {
  it('is named by its chart type, as the palette names it', () => {
    expect(kindLabel(createShape('bar-chart', 0, 0))).toBe('Column chart');
    expect(kindLabel({ ...createShape('bar-chart', 0, 0), chartVariant: 'horizontal' })).toBe(
      'Bar chart',
    );
  });
});

describe('shapeKindLabel', () => {
  it('reads a shape kind as prose, for the Shape tiles of the element menu', () => {
    expect(shapeKindLabel('square')).toBe('Square');
    expect(shapeKindLabel('pie-chart')).toBe('Pie chart');
  });
});

describe('describeSelected', () => {
  const pinned = (elementId: string) => ({
    kind: 'pinned' as const,
    elementId,
    anchor: 'e' as const,
  });
  const travel = { ...createShape('square', 0, 0), id: 'travel', label: 'Travel' };
  const hotel = { ...createShape('square', 0, 0), id: 'hotel', label: 'Team\n offsite' };
  const blank = { ...createShape('square', 0, 0), id: 'blank' };

  it('names what a pinned arrow joins, its own label first', () => {
    const a = { ...arrow(), from: pinned('travel'), to: pinned('hotel') };
    expect(describeSelected(a, [travel, hotel])).toBe("an Arrow from 'Travel' to 'Team offsite'");
    expect(describeSelected({ ...a, label: 'yes' }, [travel, hotel])).toBe(
      "an Arrow 'yes' from 'Travel' to 'Team offsite'",
    );
  });

  it('leaves out a free end, an unlabelled end and a missing one', () => {
    expect(describeSelected({ ...arrow(), to: pinned('travel') }, [travel])).toBe(
      "an Arrow to 'Travel'",
    );
    expect(
      describeSelected({ ...arrow(), from: pinned('blank'), to: pinned('gone') }, [blank]),
    ).toBe('an Arrow');
  });

  it('is describeOne for anything else', () => {
    expect(describeSelected(travel, [travel])).toBe("'Travel'");
  });
});

// docs/specs/004-interface-design/canvas-accessibility.md "Names on elements": an img's children are presentational,
// so an element whose face holds controls is a named group, and one that is only drawn stays a picture.
describe('elementRole', () => {
  const shape = (kind: string) =>
    ({ id: 's', type: 'shape', shape: kind, x: 0, y: 0, width: 10, height: 10 }) as Element;
  it('keeps a drawn element a picture', () => {
    expect(elementRole(shape('square'))).toBe('img');
    expect(
      elementRole({
        id: 'i',
        type: 'image',
        imageId: 'pic',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe('img');
  });

  it('makes an element with controls on its face a group', () => {
    expect(elementRole(shape('checklist'))).toBe('group');
    expect(
      elementRole({
        id: 'i',
        type: 'image',
        imageId: null,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe('group');
    expect(
      elementRole({
        id: 'v',
        type: 'video',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      } as unknown as Element),
    ).toBe('group');
  });
});
