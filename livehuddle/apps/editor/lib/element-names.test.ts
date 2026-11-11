import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@livehuddle/document';
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

const room = (label?: string) => ({ ...createShape('room', 0, 0), label });
// A stored (retired) arrow (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
const arrow = (label?: string) =>
  ({
    id: 'ar',
    type: 'arrow' as const,
    from: { kind: 'free' as const, x: 0, y: 0 },
    to: { kind: 'free' as const, x: 10, y: 10 },
    label,
  }) as Extract<Element, { type: 'arrow' }>;
// A stored pen stroke, path or annotation: a retired boxed kind.
const retiredBox = (type: string, extra: object = {}) =>
  ({ id: type, type, x: 0, y: 0, width: 10, height: 10, ...extra }) as unknown as Element;

describe('kindLabel', () => {
  it('names shapes by their concrete sub-kind, others by type', () => {
    expect(kindLabel(room())).toBe('Room');
    expect(kindLabel(arrow())).toBe('Arrow');
    expect(kindLabel(createSticky(0, 0))).toBe('Sticky note');
    expect(kindLabel(createText(0, 0))).toBe('Text');
  });

  // D24: the retired part-4 kinds read by their placeholder's name.
  it('names a stored arrow, line, pen stroke, path and annotation by their placeholder', () => {
    expect(kindLabel({ ...arrow(), arrowEnds: 'none' })).toBe('Line');
    expect(kindLabel(retiredBox('freehand', { pen: 'highlighter' }))).toBe('Drawing');
    expect(kindLabel(retiredBox('path'))).toBe('Path');
    expect(kindLabel(retiredBox('annotation'))).toBe('Annotation');
  });
});

describe('describeOne / describeMany', () => {
  it('prefers the quoted label, falls back to the articled kind', () => {
    expect(describeOne(room('Login'))).toBe("'Login'");
    expect(describeOne(room())).toBe('a Room');
    expect(describeOne(arrow('yes'))).toBe('an Arrow');
  });

  it('groups a mixed multi-selection by kind', () => {
    expect(describeMany([room(), room(), arrow()])).toBe('2 Rooms & an Arrow');
  });
});

describe('elementAriaLabel', () => {
  it('leads with the kind, then the quoted label when present', () => {
    expect(elementAriaLabel(room('Login'))).toBe('Room "Login"');
    expect(elementAriaLabel(room('  '))).toBe('Room');
    expect(elementAriaLabel(arrow('yes'))).toBe('Arrow "yes"');
    expect(elementAriaLabel(createSticky(0, 0))).toBe('Sticky note');
  });
});

describe('shapeKindLabel', () => {
  it('reads a shape kind as prose', () => {
    expect(shapeKindLabel('coffee-machine')).toBe('Coffee machine');
    expect(shapeKindLabel('pie-chart')).toBe('Pie chart');
  });
});

describe('describeSelected', () => {
  const pinned = (elementId: string) => ({
    kind: 'pinned' as const,
    elementId,
    anchor: 'e' as const,
  });
  const travel = { ...createSticky(0, 0), id: 'travel', label: 'Travel' };
  const hotel = { ...createSticky(0, 0), id: 'hotel', label: 'Team\n offsite' };
  const blank = { ...createSticky(0, 0), id: 'blank' };

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
// docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": named as its placeholder names it.
describe('a retired element’s kind', () => {
  const retired = (shape: string, extra: object = {}) =>
    ({
      id: 'r',
      type: 'shape',
      shape,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      ...extra,
    }) as unknown as Element;
  it('reads as the name it was known by, and a session button as its tool', () => {
    expect(kindLabel(retired('qa-board'))).toBe('Q&A Board');
    expect(kindLabel(retired('session-button', { session: { tool: 'poll' } }))).toBe('Poll');
    expect(kindLabel(retired('no-such-kind'))).toBe('Unknown Element');
    expect(elementAriaLabel(retired('agenda', { label: 'Monday' }))).toBe('Agenda "Monday"');
  });

  it("is a group: its placeholder holds an Editor's Delete button", () => {
    expect(elementRole(retired('quiz'))).toBe('group');
    expect(
      elementRole({
        id: 'v',
        type: 'video',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      } as unknown as Element),
    ).toBe('group');
  });
});

describe('elementRole', () => {
  const shape = (kind: string) =>
    ({ id: 's', type: 'shape', shape: kind, x: 0, y: 0, width: 10, height: 10 }) as Element;
  it('keeps a drawn element a picture', () => {
    expect(elementRole(shape('room'))).toBe('img');
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
    for (const kind of ['mode-button', 'focus-button', 'portal'])
      expect(elementRole(shape(kind))).toBe('group');
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

  // Indicator buttons (a note, a link, an action, comments) are controls on any element's face: axe's
  // nested-interactive, and unreachable inside a picture.
  it('makes an element showing indicator buttons a group', () => {
    expect(elementRole(shape('room'), true)).toBe('group');
    expect(elementRole(shape('room'), false)).toBe('img');
  });

  it('makes a table a group: its cells edit in place and its track menus are buttons', () => {
    expect(
      elementRole({
        id: 't',
        type: 'table',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        cells: [['a']],
      } as unknown as Element),
    ).toBe('group');
  });
});
