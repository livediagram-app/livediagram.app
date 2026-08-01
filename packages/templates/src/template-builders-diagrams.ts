// Per-template element builders for the diagram-style templates: venn,
// journey, fishbone, pyramid and flywheel. Split out of template-builders.ts
// to keep each file under the ~1000-line budget; build-template dispatches
// here. Each builder is pure: (cx, cy) -> Element[].
//
// The three timelines moved to ./template-builders-timelines: they were half
// this file and are a family of their own.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// Three overlapping outlined circles arranged in a triangle so the
// intersections are visible. Each set gets a label rendered outside
// the circle (toward the corner away from the centroid) and there's
// a small "All" label at the centre intersection. Outlined-only
// (no fill) so the overlap reads cleanly.
export function buildVenn(cx: number, cy: number): Element[] {
  const radius = 380;
  // Triangle offsets — each circle sits ~0.6r from the centroid so
  // pairwise overlap is meaningful but the three-way intersection
  // stays a recognisable lens.
  const offset = radius * 0.6;
  // The classic design-thinking lenses: an idea worth building sits where
  // Desirable (people want it), Feasible (we can build it), and Viable (it
  // sustains a business) overlap. Concrete, recognisable, and easy to retheme.
  const centers = [
    { x: cx, y: cy - offset, label: 'Desirable', tx: 0, ty: -radius - 60 },
    { x: cx - offset * 0.95, y: cy + offset * 0.55, label: 'Feasible', tx: -radius - 120, ty: 0 },
    { x: cx + offset * 0.95, y: cy + offset * 0.55, label: 'Viable', tx: radius + 120, ty: 0 },
  ];
  const labelW = 320;
  const labelH = 80;
  const elements: Element[] = [];
  centers.forEach((c) => {
    elements.push({
      ...createShape('circle', c.x - radius, c.y - radius),
      width: radius * 2,
      height: radius * 2,
      fillColor: '#ffffff',
      opacity: 0.7,
    });
    elements.push({
      ...createText(c.x - labelW / 2 + c.tx, c.y - labelH / 2 + c.ty),
      width: labelW,
      height: labelH,
      label: c.label,
      textSize: 'md',
      textAlignX: 'center',
    });
  });
  // Centre label sits at the geometric centroid of the three circle
  // centres — that's where all three lenses overlap.
  const centroidX = (centers[0]!.x + centers[1]!.x + centers[2]!.x) / 3;
  const centroidY = (centers[0]!.y + centers[1]!.y + centers[2]!.y) / 3;
  elements.push({
    ...createText(centroidX - 160, centroidY - 40),
    width: 320,
    height: 80,
    label: 'Sweet spot',
    textSize: 'lg',
    textAlignX: 'center',
  });
  return elements;
}

// Customer-journey scaffold: a row of stage cards connected by arrows,
// with a sticky note under each stage capturing how the user feels at
// that moment. Five stages is the sweet spot — more crowds; fewer
// reads as a flowchart.
export function buildJourney(cx: number, cy: number): Element[] {
  const stages: { label: string; feeling: string }[] = [
    { label: 'Awareness', feeling: 'Curious' },
    { label: 'Consideration', feeling: 'Comparing options' },
    { label: 'Decision', feeling: 'Confident' },
    { label: 'Onboarding', feeling: 'Eager but uncertain' },
    { label: 'Loyalty', feeling: 'Advocate' },
  ];
  const cardW = 208;
  const cardH = 94;
  const stickyW = 208;
  const stickyH = 126;
  const gap = 56;
  const vGap = 44;
  const totalW = stages.length * cardW + (stages.length - 1) * gap;
  const startX = cx - totalW / 2;
  const blockH = cardH + vGap + stickyH;
  const cardY = cy - blockH / 2;
  const stickyY = cardY + cardH + vGap;

  // Stage cards + their connectors are the journey's scaffold layer
  // (spec/74); the feeling stickies users rewrite ride the content layer.
  const cards: Element[] = [];
  const stickies: Element[] = [];
  stages.forEach((s, i) => {
    const x = startX + i * (cardW + gap);
    cards.push({
      ...createShape('square', x, cardY),
      width: cardW,
      height: cardH,
      label: s.label,
      textSize: 'md',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    stickies.push({
      ...createSticky(x, stickyY),
      width: stickyW,
      height: stickyH,
      label: s.feeling,
      textSize: 'sm',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });
  // Connectors PINNED between adjacent stage cards, so they reflow when
  // the user repositions a stage rather than floating free.
  const arrows: Element[] = [];
  for (let i = 0; i < cards.length - 1; i++) {
    arrows.push({
      ...createPinnedArrow(cards[i]!.id, 'e', cards[i + 1]!.id, 'w'),
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
  }
  return [...cards, ...stickies, ...arrows];
}

// Cause-and-effect (Ishikawa) skeleton: a horizontal spine arrow
// pointing at the "Effect" card, with four diagonal category branches
// (two above, two below) feeding into the spine. The branches are
// arrows so the visual reads as causes flowing INTO the spine.
export function buildFishbone(cx: number, cy: number): Element[] {
  const spineLength = 600;
  const branchOffset = 130;
  const branchSpacing = 180;
  const effectW = 160;
  const effectH = 70;
  const categoryW = 130;
  const categoryH = 40;

  const spineLeft = cx - spineLength / 2;
  const spineRight = cx + spineLength / 2;
  const elements: Element[] = [];

  // Effect card at the head of the spine. A concrete problem statement
  // (rather than the literal word "Effect") shows what the four cause
  // categories are meant to explain; users swap it for their own.
  elements.push({
    ...createShape('square', spineRight, cy - effectH / 2),
    width: effectW,
    height: effectH,
    label: 'Late delivery',
    textSize: 'md',
    // The effect is the outcome every cause feeds into → hero preset.
    colorPreset: 'bold',
  });

  // Spine arrow → pointing at the Effect card.
  elements.push(createArrow(spineLeft, cy, spineRight, cy));

  // Four category branches feeding into the spine. The two above sit
  // at branchOffset above the spine; the two below sit at branchOffset
  // below. branchSpacing pushes them apart along x so they fan out.
  const categories = [
    { label: 'People', x: cx - branchSpacing, above: true },
    { label: 'Process', x: cx + branchSpacing * 0.3, above: true },
    { label: 'Equipment', x: cx - branchSpacing, above: false },
    { label: 'Materials', x: cx + branchSpacing * 0.3, above: false },
  ];
  categories.forEach((c) => {
    const branchY = c.above ? cy - branchOffset : cy + branchOffset;
    const cardY = c.above ? branchY - categoryH : branchY;
    elements.push({
      ...createShape('square', c.x - categoryW / 2, cardY),
      width: categoryW,
      height: categoryH,
      label: c.label,
      textSize: 'sm',
    });
    // Branch arrow from the corner of the category card down/up to
    // a point on the spine to the right of the card.
    const fromX = c.x;
    const fromY = branchY;
    const toX = c.x + 110;
    const toY = cy;
    elements.push(createArrow(fromX, fromY, toX, toY));
  });
  return elements;
}

// Four-tier pyramid built from squares of decreasing width, stacked
// peak-up. Generic labels because the use case ranges from Maslow's
// hierarchy to "strategy / tactics / operations / daily" decks —
// users rename per their domain.
export function buildPyramid(cx: number, cy: number): Element[] {
  const tiers = ['Vision', 'Strategy', 'Tactics', 'Operations'];
  const tierH = 110;
  const baseWidth = 760;
  const widthStep = 140;
  const elements: Element[] = [];
  const totalH = tiers.length * tierH;
  const topY = cy - totalH / 2;
  tiers.forEach((label, i) => {
    // First array entry renders as the apex: narrowest on top, widening
    // down to the full-width foundation. (This used to subtract i itself,
    // which put the WIDEST tier on top — an upside-down pyramid.)
    const tierW = baseWidth - (tiers.length - 1 - i) * widthStep;
    const x = cx - tierW / 2;
    const y = topY + i * tierH;
    elements.push({
      ...createShape('square', x, y),
      width: tierW,
      height: tierH,
      label,
      textSize: 'md',
      // The apex (first tier) is the focal point of the pyramid → hero preset.
      ...(i === 0 ? { colorPreset: 'bold' } : {}),
    });
  });
  return elements;
}

// Flywheel: central hub circle + four reinforcing-stage sector
// circles arranged at 12/3/6/9 o'clock, connected by a clockwise loop
// of arrows. A small caption sits outside each sector with example
// tactics. Reads as a momentum loop rather than a static four-up.
export function buildFlywheel(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const hubSize = 200;
  const sectorSize = 160;
  const orbitRadius = 260;
  const captionOffset = 110;
  const captionW = 200;
  const captionH = 50;

  const hub = {
    ...createShape('circle', cx - hubSize / 2, cy - hubSize / 2),
    width: hubSize,
    height: hubSize,
    label: 'Growth flywheel',
    textSize: 'md' as const,
    // The hub drives the whole loop → hero preset.
    colorPreset: 'bold',
  };
  elements.push(hub);

  type SectorSpec = {
    angleDeg: number;
    label: string;
    caption: string;
    // Anchors on THIS sector. `out` is where this sector's outgoing
    // arrow leaves (toward the next sector clockwise). `into` is
    // where this sector's incoming arrow arrives (from the previous
    // sector). Picking the cardinal anchor that FACES the neighbour
    // keeps the arrow off the hub and off the other sectors — e.g.
    // Attract (top) leaves from its east face toward Engage (right),
    // and Engage's incoming arrow arrives at its north face.
    out: Anchor;
    into: Anchor;
  };
  // Clockwise starting at the top. Each sector's `out` faces the
  // NEXT sector clockwise; each `into` faces the PREVIOUS sector.
  const sectors: SectorSpec[] = [
    {
      angleDeg: -90,
      label: 'Attract',
      caption: 'Ads, SEO, content',
      out: 'e', // Attract.E -> Engage.N
      into: 'w', // Refer.N -> Attract.W
    },
    {
      angleDeg: 0,
      label: 'Engage',
      caption: 'Demos, onboarding, support',
      out: 's', // Engage.S -> Delight.E
      into: 'n', // Attract.E -> Engage.N
    },
    {
      angleDeg: 90,
      label: 'Delight',
      caption: 'Wins, outcomes, wow moments',
      out: 'w', // Delight.W -> Refer.S
      into: 'e', // Engage.S -> Delight.E
    },
    {
      angleDeg: 180,
      label: 'Refer',
      caption: 'Reviews, word of mouth, referrals',
      out: 'n', // Refer.N -> Attract.W
      into: 's', // Delight.W -> Refer.S
    },
  ];

  const sectorElements = sectors.map(({ angleDeg, label }) => {
    const rad = (angleDeg * Math.PI) / 180;
    const sx = cx + Math.cos(rad) * orbitRadius - sectorSize / 2;
    const sy = cy + Math.sin(rad) * orbitRadius - sectorSize / 2;
    return {
      ...createShape('circle', sx, sy),
      width: sectorSize,
      height: sectorSize,
      label,
      textSize: 'md' as const,
    };
  });
  elements.push(...sectorElements);

  // Captions sit OUTSIDE each sector, in line with the sector's
  // outward direction from the hub. Positioned by the same angle as
  // the sector, just further out.
  sectors.forEach(({ angleDeg, caption }) => {
    const rad = (angleDeg * Math.PI) / 180;
    const dist = orbitRadius + sectorSize / 2 + captionOffset;
    const cxC = cx + Math.cos(rad) * dist;
    const cyC = cy + Math.sin(rad) * dist;
    elements.push({
      ...createText(cxC - captionW / 2, cyC - captionH / 2),
      width: captionW,
      height: captionH,
      label: caption,
      textSize: 'sm',
    });
  });

  // Clockwise arrows between adjacent sectors. The outgoing arrow
  // leaves THIS sector's `out` anchor and lands on the NEXT sector's
  // `into` anchor, so each arrow stays on the outside of the wheel
  // rather than cutting through the hub.
  //
  // Style: curved so the connector arcs around the outside of the
  // wheel (a straight line between adjacent sectors cuts close to
  // the hub at this radius), and dashed so it reads as "ongoing
  // momentum / repeat cycle" rather than a one-shot flow. A slow
  // "dashes" flow animation runs by default so the momentum reads as
  // motion the moment the template lands, not a static diagram.
  sectors.forEach((sector, i) => {
    const next = sectors[(i + 1) % sectors.length]!;
    const nextEl = sectorElements[(i + 1) % sectors.length]!;
    elements.push({
      ...createPinnedArrow(sectorElements[i]!.id, sector.out, nextEl.id, next.into),
      arrowStyle: 'curved',
      strokeStyle: 'dashed',
      flow: 'dashes',
      flowSpeed: 'slow',
    });
  });

  return elements;
}
