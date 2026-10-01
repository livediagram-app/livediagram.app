// Cause-and-effect (Ishikawa) diagram: a fish whose head is the problem and
// whose bones are the places causes hide. Its own file because a real
// fishbone is geometry-heavy (six bones, twelve ribs) and would have pushed
// template-builders-diagrams past the file-size target.
//
// The builder is pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md
// "Templates" for the catalogue entry.
import { createArrow, createShape, createText, type Element } from '@livediagram/document';

const SPINE_INK = '#334155';
const MUTED = '#64748b';

// A worked example that hangs together: one concrete effect ("Orders ship 2
// days late"), six cause categories (the classic 6Ms, with Tools and
// Environment in plain words), and two specific sub-causes on each bone.
// Bones alternate above / below the spine at a consistent 60°, each ending in
// a tinted category tag; sub-causes sit on short horizontal ribs off the bone,
// which is how the method is drawn on a whiteboard. A muted prompt under the
// fish says how to use it: keep asking "why?" along each bone.
export function buildFishbone(cx: number, cy: number): Element[] {
  type Bone = { label: string; fill: string; ink: string; causes: [string, string] };
  // Columns left to right; the first three bones sit above the spine, the
  // last three below, each column pairing an above and a below bone.
  const bones: Bone[] = [
    {
      label: 'People',
      fill: '#ffe4e6',
      ink: '#be123c',
      causes: ['New packers not trained on scanners', 'Peak days run understaffed'],
    },
    {
      label: 'Process',
      fill: '#fef3c7',
      ink: '#b45309',
      causes: ['Orders batched daily, not hourly', 'Addresses checked by hand'],
    },
    {
      label: 'Tools',
      fill: '#dbeafe',
      ink: '#1d4ed8',
      causes: ['Label printer jams at volume', 'Stock system slows after 4pm'],
    },
    {
      label: 'Materials',
      fill: '#dcfce7',
      ink: '#15803d',
      causes: ['Common box sizes run out', 'Supplier sends mixed SKUs'],
    },
    {
      label: 'Measurement',
      fill: '#ede9fe',
      ink: '#6d28d9',
      causes: ['Clock starts at payment, not order', 'No alert when an SLA slips'],
    },
    {
      label: 'Environment',
      fill: '#e2e8f0',
      ink: '#334155',
      causes: ['Pick routes cross the whole floor', 'Courier cut-off is 3pm'],
    },
  ];

  // Geometry. Bones meet the spine at three evenly spaced joints; each bone
  // rises (or falls) boneH over boneDX, a consistent 60° slant.
  const boneH = 300;
  const boneDX = boneH / Math.sqrt(3);
  const jointGap = 400;
  const headW = 240;
  const headH = 132;
  const tagW = 170;
  const tagH = 48;
  const ribLen = 190;
  const ribTextW = 236;
  const ribTextH = 44;
  const tailLen = 90;

  // Spine runs from the tail (left) to the head (right). The composition's
  // horizontal extent is: leftmost rib text .. head right edge, so centre on
  // that span.
  const firstJoint = 0;
  const lastJoint = 2 * jointGap;
  const headLeft = lastJoint + 150;
  const leftMost = firstJoint - boneDX - ribTextW + 40;
  const rightMost = headLeft + headW;
  const ox = cx - (leftMost + rightMost) / 2;
  const spineLeft = ox + leftMost + 20;
  const spineRight = ox + headLeft;

  const elements: Element[] = [];

  // Spine, then the tail fins: two short strokes flaring back from its end.
  elements.push({
    ...createArrow(spineLeft, cy, spineRight, cy),
    strokeColor: SPINE_INK,
    strokeWidth: 4,
    routeBehind: false,
  });
  for (const dir of [-1, 1]) {
    elements.push({
      ...createArrow(spineLeft, cy, spineLeft - tailLen * 0.6, cy + dir * tailLen * 0.6),
      arrowEnds: 'none',
      strokeColor: SPINE_INK,
      strokeWidth: 4,
      routeBehind: false,
    });
  }

  bones.forEach((b, i) => {
    const above = i < 3;
    const col = i % 3;
    const jointX = ox + firstJoint + col * jointGap;
    const sign = above ? -1 : 1;
    const endX = jointX - boneDX;
    const endY = cy + sign * boneH;

    elements.push({
      ...createArrow(endX, endY, jointX, cy),
      arrowEnds: 'none',
      strokeColor: SPINE_INK,
      strokeWidth: 2,
      routeBehind: false,
    });
    // Category tag caps the bone's far end.
    elements.push({
      ...createShape('stadium', endX - tagW / 2, above ? endY - tagH : endY),
      width: tagW,
      height: tagH,
      label: b.label,
      textSize: 'md',
      textBold: true,
      fillColor: b.fill,
      strokeColor: b.ink,
      textColor: b.ink,
    });
    // Two ribs at a third and two thirds of the way down the bone, each a
    // short horizontal stroke to the left with its sub-cause resting on it.
    b.causes.forEach((cause, k) => {
      const t = (k + 1) / 3;
      const rx = endX + (jointX - endX) * t;
      const ry = endY + (cy - endY) * t;
      elements.push({
        ...createArrow(rx - ribLen, ry, rx, ry),
        arrowEnds: 'none',
        strokeColor: '#94a3b8',
        strokeWidth: 2,
        routeBehind: false,
      });
      // Above the spine the bone leans back over the text's top-right
      // corner (60° slant), so that label steps left to clear it.
      const clear = above ? ribTextH / Math.sqrt(3) + 8 : 6;
      elements.push({
        ...createText(rx - ribTextW - clear, ry - ribTextH - 2),
        width: ribTextW,
        height: ribTextH,
        label: cause,
        textSize: 'sm',
        textAlignX: 'right',
        textAlignY: 'bottom',
      });
    });
  });

  // The head: the effect every bone feeds into.
  elements.push({
    ...createShape('square', spineRight, cy - headH / 2),
    width: headW,
    height: headH,
    label: 'Orders ship 2 days late',
    textSize: 'md',
    textBold: true,
    colorPreset: 'bold',
  });
  elements.push({
    ...createText(spineRight, cy - headH / 2 - 38),
    width: headW,
    height: 30,
    label: 'The problem',
    textSize: 'sm',
    textAlignX: 'center',
    textColor: MUTED,
  });

  const promptW = 640;
  elements.push({
    ...createText(cx - promptW / 2, cy + boneH + tagH + 40),
    width: promptW,
    height: 32,
    label: 'Ask "why?" along each bone until you reach a cause you can fix',
    textSize: 'sm',
    textAlignX: 'center',
    textColor: MUTED,
  });
  return elements;
}
