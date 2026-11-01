import {
  buildMindTemplate,
  createText,
  MIND_HUES,
  runsPlainText,
  type MindHue,
  type MindSpec,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livehuddle/document';

// The mind-map templates (docs/specs/009-elements/mind-node.md "Templates"). Every one is built from
// MIND NODES carrying their parent pointers and the root's flow, and laid out
// by the same `layoutMindTree` that keyboard growth uses, so a template is a
// live, tidy map rather than a picture of one: select any node, and Tab and
// Enter grow it in place, with the new nodes matching the template's own.
// Squares and circles looked identical and did nothing.

// The builder lives with the mind-node layout in the document package; templates import it from here as before.
export { buildMindTemplate, type MindSpec };

// Radial mind map: a real plan (a team offsite) rather than a diagram of one.
// A bold round nucleus names the topic and its dates; five branches radiate
// from it, each in its OWN hue (card tint, border and connector alike) with a
// line-art glyph for what it covers, so a glance finds "the money one" or
// "the fun one". Leaves are plain white cards edged in their branch's hue
// carrying concrete facts (a venue, a price, a train time). A muted line
// under the map teaches the two keys that grow it. Because growth copies the
// look of a node at the same level and the connector of its siblings, a leaf
// added to a branch comes out in that branch's colour.
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
export function mindHowTo(map: Element[], label: string): Element {
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
// (the tree flow), worked as a quarter's content plan. The three levels read
// apart at a glance, in the radial map's grammar: a bold root naming the plan
// and its quarter, branches each in their OWN hue (tint, border, glyph and the
// connector into them), and plain white leaves edged in their branch's hue
// carrying concrete pieces of work. Growth copies the look of a node at the
// same level and its siblings' connector, so a leaf added to Video comes out
// rose. Every box is sized so its longest label sits on one line.
const CONTENT_BRANCHES: { label: string; icon: string; leaves: string[] }[] = [
  { label: 'Blog', icon: 'edit', leaves: ['SEO guides, 2 a month', 'Guest posts from users'] },
  {
    label: 'Social',
    icon: 'message',
    leaves: ['Weekly tips carousel', 'Creator collabs', 'Live Q&A on Fridays'],
  },
  { label: 'Email', icon: 'mail', leaves: ['Monthly newsletter', 'Five-day onboarding'] },
  { label: 'Events', icon: 'calendar', leaves: ['Two webinars', 'Meetup in Leeds'] },
  { label: 'Video', icon: 'camera', leaves: ['Product tutorials', 'Customer stories'] },
];

export function buildMindMapTree(cx: number, cy: number): Element[] {
  const rootRuns: TextRun[] = [
    { text: 'Content strategy', bold: true },
    { text: '\nQ3 · grow sign-ups 20%', size: 'sm' },
  ];
  const map = buildMindTemplate(
    {
      label: runsPlainText(rootRuns),
      // Root of the tree: the strongest preset and the largest text, so the
      // topic anchors the outline.
      look: { width: 300, height: 112, textSize: 'lg', colorPreset: 'bold', richText: rootRuns },
      children: CONTENT_BRANCHES.map((b, i) => {
        const hue = MIND_HUES[(i + 1) % MIND_HUES.length]!;
        return {
          label: b.label,
          look: {
            width: 170,
            height: 60,
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
              width: 220,
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
    'tree',
    cx,
    cy,
  );
  return [
    ...map,
    mindHowTo(map, 'Select any idea, then press Tab to add a child or Enter to add a sibling.'),
  ];
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
