import { describe, expect, it } from 'vitest';
import {
  MIND_CONNECTOR_LOOK,
  applyShapeVariant,
  createArrow,
  createShape,
  type ArrowElement,
  type ShapeElement,
} from '@liveplanner/document';
import { dressMindConnector, dressMindNode } from './mind-dress';

// docs/specs/009-elements/org-chart.md "Growing" (blueprint org-chart.md I1), and the ordinary mind node's dress.

const tab = { theme: 'default' };
const root = applyShapeVariant(createShape('mind-node', 0, 0), 'org-chart');
const fresh = () => ({ ...createShape('mind-node', 0, 200), label: '' });
const arrow = () => createArrow(0, 0, 10, 10);

describe('dressing a grown mind node', () => {
  it("makes a person map's new node a person node with no role, sized like the root when it is the first report", () => {
    const node = dressMindNode(fresh(), null, tab, root);
    expect(node.mindLook).toBe('person');
    expect(node.pageSubtitle).toBeUndefined();
    expect([node.width, node.height]).toEqual([root.width, root.height]);
  });

  it("keeps a sibling's look and size in a person map, and leaves an ordinary map alone", () => {
    const sibling = { ...root, width: 240, pageSubtitle: 'Platform' } as ShapeElement;
    const node = dressMindNode(fresh(), sibling, tab, root);
    expect(node.width).toBe(240);
    expect(node.pageSubtitle).toBeUndefined();
    const plainRoot = createShape('mind-node', 0, 0);
    expect(dressMindNode(fresh(), null, tab, plainRoot).mindLook).toBeUndefined();
  });

  it('keeps the default connector look, which an org chart routes as its bracket', () => {
    expect(dressMindConnector(arrow(), null)).toMatchObject(MIND_CONNECTOR_LOOK);
    const dashed = { ...arrow(), strokeStyle: 'dashed', arrowStyle: 'straight' } as ArrowElement;
    expect(dressMindConnector(arrow(), dashed)).toMatchObject({ arrowStyle: 'straight' });
  });
});
