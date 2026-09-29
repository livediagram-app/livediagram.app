import {
  createPinnedArrow,
  createShape,
  layoutMindTree,
  MIND_CONNECTOR_LOOK,
  mindConnectorAnchors,
  type Element,
  type MindFlow,
  type ShapeElement,
} from '@livediagram/document';

// The mind-map templates (docs/specs/009-elements/mind-node.md "Templates"). Every one is built from
// MIND NODES carrying their parent pointers and the root's flow, and laid out
// by the same `layoutMindTree` that keyboard growth uses, so a template is a
// live, tidy map rather than a picture of one: select any node, and Tab and
// Enter grow it in place, with the new nodes matching the template's own.
// Squares and circles looked identical and did nothing.

/** One node of a template map: its label, its look, and what hangs off it. */
type MindSpec = {
  label: string;
  look: Partial<ShapeElement> & { width: number; height: number };
  children?: MindSpec[];
};

function buildMindTemplate(spec: MindSpec, flow: MindFlow, cx: number, cy: number): Element[] {
  const nodes: ShapeElement[] = [];
  const make = (s: MindSpec, parentId?: string): ShapeElement => {
    // Every node starts centred on the origin, so the layout reads sibling
    // order from the outline (a tie on position falls back to document order)
    // rather than from wherever a builder happened to put them.
    const el: ShapeElement = {
      ...(createShape('mind-node', 0, 0) as ShapeElement),
      ...s.look,
      label: s.label,
      x: -s.look.width / 2,
      y: -s.look.height / 2,
      ...(parentId ? { mindParentId: parentId } : { mindFlow: flow }),
    };
    nodes.push(el);
    for (const c of s.children ?? []) make(c, el.id);
    return el;
  };
  const root = make(spec);
  const layout = layoutMindTree(nodes, root.id, flow);
  const placed = nodes.map((n) => ({ ...n, ...layout.get(n.id)! }));
  // Centre the whole map on the drop point. A whole-pixel shift keeps the
  // layout exact, so the template still reads as tidy and grows tidily.
  const left = Math.min(...placed.map((n) => n.x));
  const right = Math.max(...placed.map((n) => n.x + n.width));
  const top = Math.min(...placed.map((n) => n.y));
  const bottom = Math.max(...placed.map((n) => n.y + n.height));
  const dx = Math.round(cx - (left + right) / 2);
  const dy = Math.round(cy - (top + bottom) / 2);
  const shifted = placed.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const byId = new Map(shifted.map((n) => [n.id, n]));
  const arrows = shifted.flatMap((child) => {
    const parent = child.mindParentId ? byId.get(child.mindParentId) : undefined;
    if (!parent) return [];
    const [from, to] = mindConnectorAnchors(flow, parent, child);
    return [{ ...createPinnedArrow(parent.id, from, child.id, to), ...MIND_CONNECTOR_LOOK }];
  });
  return [...arrows, ...shifted];
}

// Radial mind map: a round nucleus, four tinted branches, two plain leaves
// each, fanned around the centre (the bubble flow).
export function buildMindMap(cx: number, cy: number): Element[] {
  const branch = (label: string, leaves: [string, string]): MindSpec => ({
    label,
    // First-level branches sit between the bold centre and plain leaves.
    look: { width: 170, height: 72, textSize: 'md', colorPreset: 'soft' },
    children: leaves.map((l) => ({ label: l, look: { width: 150, height: 56, textSize: 'sm' } })),
  });
  return buildMindTemplate(
    {
      label: 'Product launch',
      // The one round node: a nucleus with ideas radiating from it, rather
      // than a sea of equivalent boxes.
      look: { width: 170, height: 170, textSize: 'lg', colorPreset: 'bold', borderRadius: 'full' },
      children: [
        branch('Research', ['User interviews', 'Market analysis']),
        branch('Design', ['Wireframes', 'Design system']),
        branch('Build', ['Frontend', 'API & data']),
        branch('Launch', ['Marketing', 'Support docs']),
      ],
    },
    'bubble',
    cx,
    cy,
  );
}

// Tree mind map: a left-to-right outline for people who think in outlines
// (the tree flow). The three levels read apart at a glance: a large bold root,
// tinted medium branches, and small plain leaves two to a branch. Every box is
// sized so its longest label sits on one line, which the old 140px leaves did
// not ("SEO articles" spilled over its border).
export function buildMindMapTree(cx: number, cy: number): Element[] {
  const branches: [string, [string, string]][] = [
    ['Blog', ['SEO articles', 'Guest posts']],
    ['Social', ['Weekly campaigns', 'Creator collabs']],
    ['Email', ['Monthly newsletter', 'Onboarding drip']],
    ['Video', ['Product tutorials', 'Customer stories']],
  ];
  return buildMindTemplate(
    {
      label: 'Content strategy',
      // Root of the tree: the strongest preset and the largest text, so the
      // topic anchors the outline.
      look: { width: 230, height: 96, textSize: 'lg', colorPreset: 'bold' },
      children: branches.map(([label, leaves]) => ({
        label,
        // A gentle tint and medium text between the bold root and the plain
        // leaves: a legible three-tier hierarchy.
        look: { width: 170, height: 64, textSize: 'md', colorPreset: 'soft' },
        children: leaves.map((leaf) => ({
          label: leaf,
          look: { width: 200, height: 44, textSize: 'sm' },
        })),
      })),
    },
    'tree',
    cx,
    cy,
  );
}

// Bubble map: a central topic ringed by descriptive bubbles, one level deep.
// Round nodes (a full corner radius on a square mind node), so it still looks
// like a bubble map while growing like a mind map.
export function buildBubbleMap(cx: number, cy: number): Element[] {
  // Sizes give each single-word label room to sit on ONE line (100px bubbles
  // wrapped "Affordable" / "Supported" mid-word), and the bigger centre
  // carries the topic at a glance.
  const labels = ['Fast', 'Reliable', 'Simple', 'Affordable', 'Secure', 'Supported'];
  return buildMindTemplate(
    {
      label: 'Our product',
      look: { width: 180, height: 180, textSize: 'lg', colorPreset: 'bold', borderRadius: 'full' },
      children: labels.map((label) => ({
        label,
        look: { width: 134, height: 134, textSize: 'sm', borderRadius: 'full' },
      })),
    },
    'bubble',
    cx,
    cy,
  );
}
