// Per-template element builders. Lifted out of templates.ts so the
// editor's initial bundle doesn't ship ~1700 lines of element-
// construction code for templates the user rarely picks (returning
// users opening an existing diagram never trigger any of these).
// editor-page dynamic-imports this module inside the
// onChooseTemplate callback; /live/new still imports it statically
// since it's the template-creation page by definition.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a
// fresh array of Element. Sizing constants live inline so each
// template is self-describing. See spec/09 for the picker UX.

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { getTheme, recolourElementForTheme, type ThemeId } from './themes';
import { templateCanvasOverrides, type TemplateKind } from './templates';
import {
  buildLaptopWireframe,
  buildMobileWireframe,
  buildSlideDeck,
} from './template-builders-wireframes';
import { buildKanban, buildRetrospective, buildSwot } from './template-builders-boards';
import { buildLogoDesign } from './template-builders-logo';
import { buildGanttChart } from './template-builders-gantt';
import { buildLiveCard } from './template-builders-livecard';

export function buildTemplatedTab(
  kind: TemplateKind,
  themeId: ThemeId,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  const rawElements = buildTemplate(kind, 0, 0);
  const elements = rawElements.map((el) => recolourElementForTheme(el, theme));
  return {
    id: tabId,
    name: tabName,
    elements,
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  };
}

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    case 'blank':
      return buildBlank(cx, cy);
    case 'mindmap':
      return buildMindMap(cx, cy);
    case 'orgchart':
      return buildOrgChart(cx, cy);
    case 'retrospective':
      return buildRetrospective(cx, cy);
    case 'flowchart':
      return buildFlowchart(cx, cy);
    case 'kanban':
      return buildKanban(cx, cy);
    case 'swot':
      return buildSwot(cx, cy);
    case 'timeline':
      return buildTimeline(cx, cy);
    case 'venn':
      return buildVenn(cx, cy);
    case 'journey':
      return buildJourney(cx, cy);
    case 'fishbone':
      return buildFishbone(cx, cy);
    case 'pyramid':
      return buildPyramid(cx, cy);
    case 'mobile-wireframe':
      return buildMobileWireframe(cx, cy);
    case 'laptop-wireframe':
      return buildLaptopWireframe(cx, cy);
    case 'slide-deck':
      return buildSlideDeck(cx, cy);
    case 'flywheel':
      return buildFlywheel(cx, cy);
    case 'logo-design':
      return buildLogoDesign(cx, cy);
    case 'gantt':
      return buildGanttChart(cx, cy);
    case 'live-card':
      return buildLiveCard(cx, cy);
  }
}

// A truly blank canvas is intimidating, so the "Blank diagram" template
// drops a single centred rectangle that the user can rename and grow from.
function buildBlank(cx: number, cy: number): Element[] {
  const w = 220;
  const h = 100;
  return [
    {
      ...createShape('square', cx - w / 2, cy - h / 2),
      width: w,
      height: h,
      label: 'Blank Diagram',
      textSize: 'md' as const,
    },
  ];
}

function buildMindMap(cx: number, cy: number): Element[] {
  const centerSize = 170;
  const branchW = 170;
  const branchH = 80;
  const leafW = 140;
  const leafH = 60;
  const branchRadius = 260;
  const leafOffset = 230;

  // Central node: the only circle on the map. Surrounding topics use
  // squares so the hierarchy reads as "one nucleus, many ideas radiating"
  // rather than a sea of equivalent circles.
  const center = {
    ...createShape('circle', cx - centerSize / 2, cy - centerSize / 2),
    width: centerSize,
    height: centerSize,
    label: 'Main idea',
    textSize: 'lg' as const,
  };

  type BranchSpec = {
    angle: number;
    label: string;
    from: Anchor;
    to: Anchor;
    // Each branch sprouts two children (sub-topics). leafSide picks
    // which side of the parent the leaves sit on so the layout reads
    // outward from the centre rather than crossing back over the spine.
    leafSide: 'right' | 'left' | 'below' | 'above';
    leafLabels: [string, string];
  };

  const branches: BranchSpec[] = [
    {
      angle: 0,
      label: 'Topic 1',
      from: 'e',
      to: 'w',
      leafSide: 'right',
      leafLabels: ['Idea 1a', 'Idea 1b'],
    },
    {
      angle: 90,
      label: 'Topic 2',
      from: 's',
      to: 'n',
      leafSide: 'below',
      leafLabels: ['Idea 2a', 'Idea 2b'],
    },
    {
      angle: 180,
      label: 'Topic 3',
      from: 'w',
      to: 'e',
      leafSide: 'left',
      leafLabels: ['Idea 3a', 'Idea 3b'],
    },
    {
      angle: 270,
      label: 'Topic 4',
      from: 'n',
      to: 's',
      leafSide: 'above',
      leafLabels: ['Idea 4a', 'Idea 4b'],
    },
  ];

  const branchElements = branches.map(({ angle, label }) => {
    const rad = (angle * Math.PI) / 180;
    const bx = cx + Math.cos(rad) * branchRadius - branchW / 2;
    const by = cy + Math.sin(rad) * branchRadius - branchH / 2;
    return {
      ...createShape('square', bx, by),
      width: branchW,
      height: branchH,
      label,
      textSize: 'md' as const,
    };
  });

  const centerArrows = branches.map((b, i) =>
    createPinnedArrow(center.id, b.from, branchElements[i]!.id, b.to),
  );

  // Sub-topics: two per branch, fanned 30° apart around the branch's
  // outward axis so siblings don't overlap. Anchors come from the
  // branch-vs-leaf relative position so the arrow head lands on the
  // correct face.
  const leafElements: Element[] = [];
  const leafArrows: Element[] = [];
  branches.forEach((branch, i) => {
    const parent = branchElements[i]!;
    const parentCx = parent.x + parent.width / 2;
    const parentCy = parent.y + parent.height / 2;
    // Half the gap between the two leaves of a branch, applied
    // perpendicular to the branch axis. Has to be > leafW/2 (70)
    // for the horizontal pairs (above/below) so the leaves don't
    // overlap; 110 gives ~80px clear there AND ~160px between
    // centres for the vertical pairs (left/right) so they read as
    // distinct siblings rather than a touching stack.
    const spread = 110;
    branch.leafLabels.forEach((label, leafIndex) => {
      const offsetSign = leafIndex === 0 ? -1 : 1;
      let lx = parentCx;
      let ly = parentCy;
      let fromAnchor: Anchor;
      let toAnchor: Anchor;
      switch (branch.leafSide) {
        case 'right':
          lx = parentCx + leafOffset;
          ly = parentCy + offsetSign * spread;
          fromAnchor = 'e';
          toAnchor = 'w';
          break;
        case 'left':
          lx = parentCx - leafOffset;
          ly = parentCy + offsetSign * spread;
          fromAnchor = 'w';
          toAnchor = 'e';
          break;
        case 'below':
          ly = parentCy + leafOffset;
          lx = parentCx + offsetSign * spread;
          fromAnchor = 's';
          toAnchor = 'n';
          break;
        case 'above':
          ly = parentCy - leafOffset;
          lx = parentCx + offsetSign * spread;
          fromAnchor = 'n';
          toAnchor = 's';
          break;
      }
      const leaf = {
        ...createShape('square', lx - leafW / 2, ly - leafH / 2),
        width: leafW,
        height: leafH,
        label,
        textSize: 'sm' as const,
      };
      leafElements.push(leaf);
      leafArrows.push(createPinnedArrow(parent.id, fromAnchor, leaf.id, toAnchor));
    });
  });

  return [center, ...branchElements, ...leafElements, ...centerArrows, ...leafArrows];
}

function buildOrgChart(cx: number, cy: number): Element[] {
  const headW = 220;
  const headH = 80;
  const vpW = 180;
  const vpH = 64;
  const subW = 140;
  const subH = 54;

  // VP centres are `vpSpacing` apart; sub centres sit `subSpread`
  // either side of their VP. For "no sub overlap between adjacent
  // VPs", `vpSpacing` must be larger than `2 * subSpread + subW`
  // (the previous values violated this and the right-of-VP1 sub
  // collided with left-of-VP2). 360 / 100 / 140 leaves a 20 px
  // gap between adjacent VPs' inner subs.
  const vpSpacing = 360;
  const subSpread = 100;

  const ceoY = cy - 240;
  const vpY = cy - 40;
  const subY = cy + 150;

  const head = {
    ...createShape('square', cx - headW / 2, ceoY),
    width: headW,
    height: headH,
    label: 'CEO',
    textSize: 'lg' as const,
  };

  const vpLabels = ['VP Engineering', 'VP Sales', 'VP Operations'];
  const vpXs = [cx - vpW / 2 - vpSpacing, cx - vpW / 2, cx - vpW / 2 + vpSpacing];
  const vps = vpLabels.map((label, i) => ({
    ...createShape('square', vpXs[i]!, vpY),
    width: vpW,
    height: vpH,
    label,
    textSize: 'sm' as const,
  }));

  // Two direct reports under each VP. Labels are kept short on purpose
  // so they fit the smaller third-level boxes at `sm` text.
  const subLabels: ReadonlyArray<readonly [string, string]> = [
    ['Eng Lead', 'Tech Lead'],
    ['Sales Lead', 'Account Mgr'],
    ['Ops Lead', 'Finance'],
  ] as const;
  const subs = vps.flatMap((vp, i) => {
    const vpCenterX = vp.x + vpW / 2;
    const [leftLabel, rightLabel] = subLabels[i]!;
    const leftCenter = vpCenterX - subSpread;
    const rightCenter = vpCenterX + subSpread;
    return [
      {
        ...createShape('square', leftCenter - subW / 2, subY),
        width: subW,
        height: subH,
        label: leftLabel,
        textSize: 'sm' as const,
      },
      {
        ...createShape('square', rightCenter - subW / 2, subY),
        width: subW,
        height: subH,
        label: rightLabel,
        textSize: 'sm' as const,
      },
    ];
  });

  const arrows = [
    ...vps.map((v) => createPinnedArrow(head.id, 's', v.id, 'n')),
    ...subs.map((s, i) => createPinnedArrow(vps[Math.floor(i / 2)]!.id, 's', s.id, 'n')),
  ];

  return [head, ...vps, ...subs, ...arrows];
}

// Vertical flowchart with a branch. Start (stadium) → Step 1 (square)
// → Decision (diamond) → Yes path goes down to Step 2 and End; No path
// goes right to a side step that rejoins End. Demonstrates every basic
// flowchart shape (terminator / process / decision) plus a branching
// connector.
function buildFlowchart(cx: number, cy: number): Element[] {
  const termW = 220;
  const termH = 80;
  const procW = 200;
  const procH = 90;
  const decW = 200;
  const decH = 130;
  const vGap = 70;

  const startY = cy - 380;
  const step1Y = startY + termH + vGap;
  const decisionY = step1Y + procH + vGap;
  const step2Y = decisionY + decH + vGap;
  const endY = step2Y + procH + vGap;

  const start = {
    ...createShape('stadium', cx - termW / 2, startY),
    width: termW,
    height: termH,
    label: 'Start',
    textSize: 'md' as const,
  };
  const step1 = {
    ...createShape('square', cx - procW / 2, step1Y),
    width: procW,
    height: procH,
    label: 'Step 1',
    textSize: 'md' as const,
  };
  const decision = {
    ...createShape('diamond', cx - decW / 2, decisionY),
    width: decW,
    height: decH,
    label: 'Decision?',
    textSize: 'md' as const,
  };
  const step2 = {
    ...createShape('square', cx - procW / 2, step2Y),
    width: procW,
    height: procH,
    label: 'Step 2',
    textSize: 'md' as const,
  };
  const end = {
    ...createShape('stadium', cx - termW / 2, endY),
    width: termW,
    height: termH,
    label: 'End',
    textSize: 'md' as const,
  };
  // Side branch (No path): a square to the right of the decision that
  // rejoins End's east side.
  const sideStep = {
    ...createShape('square', cx + decW / 2 + 80, decisionY + decH / 2 - procH / 2),
    width: procW,
    height: procH,
    label: 'Alt path',
    textSize: 'md' as const,
  };

  const arrows = [
    createPinnedArrow(start.id, 's', step1.id, 'n'),
    createPinnedArrow(step1.id, 's', decision.id, 'n'),
    createPinnedArrow(decision.id, 's', step2.id, 'n'),
    createPinnedArrow(step2.id, 's', end.id, 'n'),
    createPinnedArrow(decision.id, 'e', sideStep.id, 'w'),
    createPinnedArrow(sideStep.id, 's', end.id, 'e'),
  ];

  return [start, step1, decision, step2, sideStep, end, ...arrows];
}

// Horizontal timeline with 5 milestone markers — circles on the line,
// alternating labels above and below so they don't crowd. Each label
// is a stacked pair: a milestone title on top and a date subtext
// beneath (e.g. "Phase 1" / "March") so the chart reads as an actual
// dated schedule, not just a sequence of named beats. Two Text
// primitives per milestone keeps the date independently styleable
// (smaller size, muted colour) without a custom element kind.
function buildTimeline(cx: number, cy: number): Element[] {
  const lineLength = 1200;
  const milestoneRadius = 22;
  const labelW = 200;
  const titleH = 40;
  const dateH = 28;
  const labelGap = 4;
  const labelBlockH = titleH + labelGap + dateH;
  const verticalOffset = 90;

  const startX = cx - lineLength / 2;
  const baseY = cy;

  const elements: Element[] = [];
  // Timeline spine: actual line via arrow primitive (no arrowheads)
  // instead of a 1-px-tall rectangle that rendered awkwardly at
  // non-1 zoom levels.
  elements.push({
    ...createArrow(startX, baseY, startX + lineLength, baseY),
    arrowEnds: 'none',
    strokeColor: '#64748b',
  });

  // Indicative date subtitles — months across the first three quarters
  // of a hypothetical project so the user can immediately read the
  // template as a timeline and replace each date with the real one.
  const milestones: { title: string; date: string }[] = [
    { title: 'Kick-off', date: 'January' },
    { title: 'Phase 1', date: 'March' },
    { title: 'Phase 2', date: 'May' },
    { title: 'Phase 3', date: 'July' },
    { title: 'Launch', date: 'September' },
  ];
  const above = (i: number) => i % 2 === 0;
  milestones.forEach(({ title, date }, i) => {
    const x = startX + ((i + 0.5) / milestones.length) * lineLength;
    elements.push({
      ...createShape('circle', x - milestoneRadius, baseY - milestoneRadius),
      width: milestoneRadius * 2,
      height: milestoneRadius * 2,
      textSize: 'sm',
    });
    // Stack the title above the date. `blockTop` is the y of the
    // whole two-line block; the title fills the top half and the
    // date sits below with a small gap. Same `blockTop` formula as
    // before, just sized for the new combined height so the
    // alternating-side layout still hugs the spine evenly.
    const blockTop = above(i) ? baseY - verticalOffset : baseY + verticalOffset - labelBlockH;
    elements.push({
      ...createText(x - labelW / 2, blockTop),
      width: labelW,
      height: titleH,
      label: title,
      textSize: 'md',
      textAlignX: 'center',
    });
    elements.push({
      ...createText(x - labelW / 2, blockTop + titleH + labelGap),
      width: labelW,
      height: dateH,
      label: date,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
    });
  });
  return elements;
}

// Three overlapping outlined circles arranged in a triangle so the
// intersections are visible. Each set gets a label rendered outside
// the circle (toward the corner away from the centroid) and there's
// a small "All" label at the centre intersection. Outlined-only
// (no fill) so the overlap reads cleanly.
function buildVenn(cx: number, cy: number): Element[] {
  const radius = 380;
  // Triangle offsets — each circle sits ~0.6r from the centroid so
  // pairwise overlap is meaningful but the three-way intersection
  // stays a recognisable lens.
  const offset = radius * 0.6;
  const centers = [
    { x: cx, y: cy - offset, label: 'Set A', tx: 0, ty: -radius - 60 },
    { x: cx - offset * 0.95, y: cy + offset * 0.55, label: 'Set B', tx: -radius - 120, ty: 0 },
    { x: cx + offset * 0.95, y: cy + offset * 0.55, label: 'Set C', tx: radius + 120, ty: 0 },
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
    label: 'All',
    textSize: 'lg',
    textAlignX: 'center',
  });
  return elements;
}

// Customer-journey scaffold: a row of stage cards connected by arrows,
// with a sticky note under each stage capturing how the user feels at
// that moment. Five stages is the sweet spot — more crowds; fewer
// reads as a flowchart.
function buildJourney(cx: number, cy: number): Element[] {
  const stages: { label: string; feeling: string }[] = [
    { label: 'Awareness', feeling: 'Curious' },
    { label: 'Consideration', feeling: 'Comparing options' },
    { label: 'Decision', feeling: 'Confident' },
    { label: 'Onboarding', feeling: 'Eager but uncertain' },
    { label: 'Loyalty', feeling: 'Advocate' },
  ];
  const cardW = 150;
  const cardH = 60;
  const stickyW = 150;
  const stickyH = 80;
  const gap = 40;
  const totalW = stages.length * cardW + (stages.length - 1) * gap;
  const startX = cx - totalW / 2;
  const cardY = cy - cardH - 30;
  const stickyY = cardY + cardH + 28;

  const elements: Element[] = [];
  stages.forEach((s, i) => {
    const x = startX + i * (cardW + gap);
    elements.push({
      ...createShape('square', x, cardY),
      width: cardW,
      height: cardH,
      label: s.label,
      textSize: 'md',
    });
    elements.push({
      ...createSticky(x, stickyY),
      width: stickyW,
      height: stickyH,
      label: s.feeling,
      textSize: 'sm',
    });
  });
  // Connector arrows between adjacent stages.
  for (let i = 0; i < stages.length - 1; i++) {
    const fromX = startX + i * (cardW + gap) + cardW;
    const toX = startX + (i + 1) * (cardW + gap);
    const midY = cardY + cardH / 2;
    elements.push(createArrow(fromX, midY, toX, midY));
  }
  return elements;
}

// Cause-and-effect (Ishikawa) skeleton: a horizontal spine arrow
// pointing at the "Effect" card, with four diagonal category branches
// (two above, two below) feeding into the spine. The branches are
// arrows so the visual reads as causes flowing INTO the spine.
function buildFishbone(cx: number, cy: number): Element[] {
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

  // Effect card at the head of the spine.
  elements.push({
    ...createShape('square', spineRight, cy - effectH / 2),
    width: effectW,
    height: effectH,
    label: 'Effect',
    textSize: 'md',
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
    const fromY = c.above ? branchY : branchY;
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
function buildPyramid(cx: number, cy: number): Element[] {
  const tiers = ['Vision', 'Strategy', 'Tactics', 'Operations'];
  const tierH = 110;
  const baseWidth = 760;
  const widthStep = 140;
  const elements: Element[] = [];
  const totalH = tiers.length * tierH;
  const topY = cy - totalH / 2;
  tiers.forEach((label, i) => {
    const tierW = baseWidth - i * widthStep;
    const x = cx - tierW / 2;
    const y = topY + i * tierH;
    elements.push({
      ...createShape('square', x, y),
      width: tierW,
      height: tierH,
      label,
      textSize: 'md',
    });
  });
  // Top-to-bottom order in the source array reads peak-down, but
  // visually the user expects the foundation at the bottom. Reverse
  // labels on render so first array entry = top tier.
  // (Already top-down in the array above; loop just iterates.)
  return elements;
}

// Flywheel: central hub circle + four reinforcing-stage sector
// circles arranged at 12/3/6/9 o'clock, connected by a clockwise loop
// of arrows. A small caption sits outside each sector with example
// tactics. Reads as a momentum loop rather than a static four-up.
function buildFlywheel(cx: number, cy: number): Element[] {
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
  // momentum / repeat cycle" rather than a one-shot flow.
  sectors.forEach((sector, i) => {
    const next = sectors[(i + 1) % sectors.length]!;
    const nextEl = sectorElements[(i + 1) % sectors.length]!;
    elements.push({
      ...createPinnedArrow(sectorElements[i]!.id, sector.out, nextEl.id, next.into),
      arrowStyle: 'curved',
      strokeStyle: 'dashed',
    });
  });

  return elements;
}
