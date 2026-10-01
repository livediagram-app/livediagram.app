import {
  createPinnedArrow,
  createShape,
  createText,
  layoutMindTree,
  MIND_CONNECTOR_LOOK,
  mindConnectorAnchors,
  runsPlainText,
  type ArrowElement,
  type Element,
  type MindFlow,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';

// The mind-map templates (docs/specs/009-elements/mind-node.md "Templates"). Every one is built from
// MIND NODES carrying their parent pointers and the root's flow, and laid out
// by the same `layoutMindTree` that keyboard growth uses, so a template is a
// live, tidy map rather than a picture of one: select any node, and Tab and
// Enter grow it in place, with the new nodes matching the template's own.
// Squares and circles looked identical and did nothing.

/** One node of a template map: its label, its look, the look of the connector
 *  into it (a branch's colour, say), and what hangs off it. */
type MindSpec = {
  label: string;
  look: Partial<ShapeElement> & { width: number; height: number };
  connector?: Partial<ArrowElement>;
  children?: MindSpec[];
};

function buildMindTemplate(spec: MindSpec, flow: MindFlow, cx: number, cy: number): Element[] {
  const nodes: ShapeElement[] = [];
  const connectorLook = new Map<string, Partial<ArrowElement>>();
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
    if (s.connector) connectorLook.set(el.id, s.connector);
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
    return [
      {
        ...createPinnedArrow(parent.id, from, child.id, to),
        ...MIND_CONNECTOR_LOOK,
        ...connectorLook.get(child.id),
      },
    ];
  });
  return [...arrows, ...shifted];
}

// Radial mind map: a real plan (a team offsite) rather than a diagram of one.
// A bold round nucleus names the topic and its dates; five branches radiate
// from it, each in its OWN hue (card tint, border and connector alike) with a
// line-art glyph for what it covers, so a glance finds "the money one" or
// "the fun one". Leaves are plain white cards edged in their branch's hue
// carrying concrete facts (a venue, a price, a train time). A muted line
// under the map teaches the two keys that grow it. Because growth copies the
// look of a node at the same level and the connector of its siblings, a leaf
// added to a branch comes out in that branch's colour.
type MindHue = { fill: string; stroke: string; text: string; leaf: string };

const MIND_HUES: MindHue[] = [
  { fill: '#d1fae5', stroke: '#10b981', text: '#065f46', leaf: '#6ee7b7' },
  { fill: '#e0f2fe', stroke: '#0ea5e9', text: '#075985', leaf: '#7dd3fc' },
  { fill: '#ede9fe', stroke: '#8b5cf6', text: '#5b21b6', leaf: '#c4b5fd' },
  { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e', leaf: '#fcd34d' },
  { fill: '#ffe4e6', stroke: '#f43f5e', text: '#9f1239', leaf: '#fda4af' },
];

const OFFSITE_BRANCHES: { label: string; icon: string; leaves: string[] }[] = [
  { label: 'Venue', icon: 'map-pin', leaves: ['Lakeside lodge', 'Deposit paid'] },
  {
    label: 'Agenda',
    icon: 'calendar',
    leaves: ['Day 1 · Strategy', 'Day 2 · Hack day', 'Day 3 · Demos'],
  },
  { label: 'Travel', icon: 'send', leaves: ['Train at 09:05', 'Minibus to lodge'] },
  { label: 'Budget', icon: 'dollar-sign', leaves: ['£12k all in', 'Food £3.5k'] },
  { label: 'Fun', icon: 'smile', leaves: ['Kayaking', 'Campfire quiz'] },
];

export function buildMindMap(cx: number, cy: number): Element[] {
  const rootRuns: TextRun[] = [
    { text: 'Team offsite', bold: true },
    { text: '\nLake District · 12-14 June', size: 'sm' },
  ];
  const map = buildMindTemplate(
    {
      label: runsPlainText(rootRuns),
      // The one round node: a nucleus with ideas radiating from it, rather
      // than a sea of equivalent boxes.
      look: {
        width: 210,
        height: 210,
        textSize: 'lg',
        colorPreset: 'bold',
        borderRadius: 'full',
        richText: rootRuns,
      },
      children: OFFSITE_BRANCHES.map((b, i) => {
        const hue = MIND_HUES[i % MIND_HUES.length]!;
        return {
          label: b.label,
          // First-level branches sit between the bold centre and plain
          // leaves: tinted in their hue, medium text, a glyph for the theme.
          look: {
            width: 170,
            height: 64,
            textSize: 'md',
            textBold: true,
            iconId: b.icon,
            fillColor: hue.fill,
            strokeColor: hue.stroke,
            textColor: hue.text,
            strokeWidth: 'thick',
          },
          connector: { strokeColor: hue.stroke, strokeWidth: 4 },
          children: b.leaves.map((leaf) => ({
            label: leaf,
            look: {
              width: 160,
              height: 44,
              textSize: 'sm',
              fillColor: '#ffffff',
              strokeColor: hue.leaf,
              textColor: '#334155',
            },
            connector: { strokeColor: hue.leaf, strokeWidth: 2 },
          })),
        };
      }),
    },
    'bubble',
    cx,
    cy,
  );
  return [
    ...map,
    mindHowTo(map, 'Select any idea, then press Tab to add a child or Enter to add a sibling.'),
  ];
}

// The muted how-to line under a map: the two keys that grow it, which a
// newcomer would otherwise only find in a hover card.
function mindHowTo(map: Element[], label: string): Element {
  const nodes = map.filter((el): el is ShapeElement => el.type === 'shape');
  const left = Math.min(...nodes.map((n) => n.x));
  const right = Math.max(...nodes.map((n) => n.x + n.width));
  const bottom = Math.max(...nodes.map((n) => n.y + n.height));
  return {
    ...createText(left, bottom + 36),
    width: right - left,
    height: 28,
    label,
    textSize: 'sm',
    textColor: '#64748b',
    textAlignX: 'center',
  };
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

// Bubble map: the Thinking Maps "describe it" map, one topic ringed by the
// adjectives that describe it. The worked example is a brand voice, the
// workshop a bubble map is most often run for: each bubble is one adjective
// in bold with a line of copy that proves it underneath, so the map doubles
// as a style guide. Every bubble takes its own hue (the mind map's branch
// palette plus teal), round mind nodes (a full corner radius) in the bubble
// flow, so Tab on the centre still adds another bubble to the ring.
// Proofs break by hand so each wraps to two even lines inside its circle.
const VOICE_BUBBLES: [string, string][] = [
  ['Warm', '"Welcome back,\nSam!"'],
  ['Clear', '"Tap Pay.\nDone."'],
  ['Playful', '"Oops, that\none\'s on us."'],
  ['Honest', '"Refunds take\n3 days."'],
  ['Curious', '"What are you\nmaking?"'],
  ['Calm', '"No rush,\nit\'s saved."'],
];
const TEAL: MindHue = { fill: '#ccfbf1', stroke: '#14b8a6', text: '#115e59', leaf: '#5eead4' };

export function buildBubbleMap(cx: number, cy: number): Element[] {
  const hues = [...MIND_HUES, TEAL];
  const rootRuns: TextRun[] = [
    { text: 'Our brand voice', bold: true },
    { text: '\nHow we sound', size: 'sm' },
  ];
  const map = buildMindTemplate(
    {
      label: runsPlainText(rootRuns),
      look: {
        width: 200,
        height: 200,
        textSize: 'lg',
        colorPreset: 'bold',
        borderRadius: 'full',
        richText: rootRuns,
      },
      children: VOICE_BUBBLES.map(([word, proof], i) => {
        const hue = hues[i % hues.length]!;
        const runs: TextRun[] = [{ text: word, bold: true, size: 'md' }, { text: `\n${proof}` }];
        return {
          label: runsPlainText(runs),
          // Sized so the adjective sits on one line and its proof on two.
          look: {
            width: 164,
            height: 164,
            textSize: 'sm',
            borderRadius: 'full',
            richText: runs,
            fillColor: hue.fill,
            strokeColor: hue.stroke,
            textColor: hue.text,
            strokeWidth: 'thick',
          },
          connector: { strokeColor: hue.stroke, strokeWidth: 3 },
        };
      }),
    },
    'bubble',
    cx,
    cy,
  );
  return [
    ...map,
    mindHowTo(
      map,
      'One adjective per bubble, with a line that proves it. Tab on the centre adds a bubble.',
    ),
  ];
}
