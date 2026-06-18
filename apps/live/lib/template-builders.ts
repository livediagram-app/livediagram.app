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
  bestAnchorTowards,
  createPinnedArrow,
  createShape,
  type Anchor,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livediagram/diagram';
import { getTheme, recolourElementsForTheme } from './themes';
import { templateCanvasOverrides, type TemplateKind } from './templates';
import {
  buildLaptopWireframe,
  buildMobileWireframe,
  buildSlideDeck,
} from './template-builders-wireframes';
import {
  buildKanban,
  buildPrioritizationMatrix,
  buildRetrospective,
  buildSwot,
} from './template-builders-boards';
import {
  buildErDiagram,
  buildSequenceDiagram,
  buildSystemArchitecture,
} from './template-builders-technical';
import { buildLogoDesign } from './template-builders-logo';
import { buildGanttChart } from './template-builders-gantt';
import { buildLiveCard } from './template-builders-livecard';
import { buildComparisonTable } from './template-builders-table';
import {
  buildFishbone,
  buildFlywheel,
  buildJourney,
  buildPyramid,
  buildTimeline,
  buildVenn,
} from './template-builders-diagrams';

export function buildTemplatedTab(
  kind: TemplateKind,
  // string, not ThemeId: may be a custom `custom:<uuid>` id (spec/44),
  // which getTheme resolves via the custom-theme registry.
  themeId: string,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  const rawElements = buildTemplate(kind, 0, 0);
  // Graph-aware recolour so multi-colour themes (spec/29) can tint each
  // branch of the scaffold a distinct hue; single-colour themes fall
  // straight through to the per-element transform.
  const elements = recolourElementsForTheme(rawElements, theme);
  return {
    id: tabId,
    name: tabName,
    elements,
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
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
    case 'mindmap-tree':
      return buildMindMapTree(cx, cy);
    case 'mindmap-bubble':
      return buildBubbleMap(cx, cy);
    case 'orgchart':
      return buildOrgChart(cx, cy);
    case 'retrospective':
      return buildRetrospective(cx, cy);
    case 'flowchart':
      return buildFlowchart(cx, cy);
    case 'swimlane':
      return buildSwimlane(cx, cy);
    case 'decision-tree':
      return buildDecisionTree(cx, cy);
    case 'approval-workflow':
      return buildApprovalWorkflow(cx, cy);
    case 'data-flow':
      return buildDataFlow(cx, cy);
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
    case 'comparison-table':
      return buildComparisonTable(cx, cy);
    case 'system-architecture':
      return buildSystemArchitecture(cx, cy);
    case 'er-diagram':
      return buildErDiagram(cx, cy);
    case 'sequence-diagram':
      return buildSequenceDiagram(cx, cy);
    case 'prioritization-matrix':
      return buildPrioritizationMatrix(cx, cy);
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

// Tree mind map (spec/09): a left-to-right hierarchy — root, a vertical stack
// of branches, and one leaf per branch — connected by plain lines. Distinct
// from the radial 'mindmap' for users who think in outlines.
function buildMindMapTree(cx: number, cy: number): Element[] {
  const rootW = 170;
  const rootH = 72;
  const branchW = 160;
  const branchH = 56;
  const leafW = 140;
  const leafH = 46;
  const rootX = cx - 360;
  const branchX = cx - 110;
  const leafX = cx + 150;
  const root = {
    ...createShape('square', rootX, cy - rootH / 2),
    width: rootW,
    height: rootH,
    label: 'Content strategy',
    textSize: 'md' as const,
    borderRadius: 'lg' as const,
  };
  const branchLabels = ['Blog', 'Social', 'Email', 'Video'];
  const leafLabels = ['SEO articles', 'Campaigns', 'Newsletter', 'Tutorials'];
  const branchYs = branchLabels.map((_, i) => cy + (i - (branchLabels.length - 1) / 2) * 110);
  const branches = branchLabels.map((label, i) => ({
    ...createShape('square', branchX, branchYs[i]! - branchH / 2),
    width: branchW,
    height: branchH,
    label,
    borderRadius: 'md' as const,
  }));
  const leaves = leafLabels.map((label, i) => ({
    ...createShape('square', leafX, branchYs[i]! - leafH / 2),
    width: leafW,
    height: leafH,
    label,
    borderRadius: 'md' as const,
  }));
  const arrows: Element[] = [];
  branches.forEach((b, i) => {
    arrows.push({ ...createPinnedArrow(root.id, 'e', b.id, 'w'), arrowEnds: 'none' as const });
    arrows.push({
      ...createPinnedArrow(b.id, 'e', leaves[i]!.id, 'w'),
      arrowEnds: 'none' as const,
    });
  });
  return [...arrows, root, ...branches, ...leaves];
}

// Bubble map (spec/09): a central topic ringed by descriptive bubbles, joined
// by plain lines. A flatter alternative to the radial mind map (no
// sub-branches). Anchors face inward via bestAnchorTowards so the spokes are
// tidy at every angle.
function buildBubbleMap(cx: number, cy: number): Element[] {
  // Sizes give each single-word label room to sit on ONE line (the old
  // 100px bubbles wrapped "Affordable" / "Supported" mid-word), and the
  // bigger centre carries the topic at a glance.
  const centerSize = 180;
  const bubbleSize = 134;
  const radius = 300;
  const center = {
    ...createShape('circle', cx - centerSize / 2, cy - centerSize / 2),
    width: centerSize,
    height: centerSize,
    label: 'Our product',
    textSize: 'lg' as const,
  };
  const labels = ['Fast', 'Reliable', 'Simple', 'Affordable', 'Secure', 'Supported'];
  const n = labels.length;
  const bubbles = labels.map((label, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const bx = cx + Math.cos(angle) * radius - bubbleSize / 2;
    const by = cy + Math.sin(angle) * radius - bubbleSize / 2;
    return {
      ...createShape('circle', bx, by),
      width: bubbleSize,
      height: bubbleSize,
      label,
      textSize: 'sm' as const,
    };
  });
  const centrePoint = { x: cx, y: cy };
  const arrows = bubbles.map((b) => {
    const bubbleCentre = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    return {
      ...createPinnedArrow(
        center.id,
        bestAnchorTowards(center, bubbleCentre),
        b.id,
        bestAnchorTowards(b, centrePoint),
      ),
      arrowEnds: 'none' as const,
      // Gently bowed spokes read as a soft radial "flower" and (now that the
      // endpoints sit on the circle edges) connect cleanly to each bubble.
      arrowStyle: 'curved' as const,
    };
  });
  return [...arrows, center, ...bubbles];
}

// Swimlane flowchart (spec/09): the same process flowing across role lanes.
// Lanes are frame containers (they paint behind their contents via framesFirst)
// with a left-aligned role label; steps sit in their lane and the arrows cross
// between lanes to show hand-offs.
function buildSwimlane(cx: number, cy: number): Element[] {
  const roles = ['Customer', 'Sales', 'Warehouse'];
  const laneW = 820;
  const laneH = 150;
  const left = cx - laneW / 2;
  const top0 = cy - (roles.length * laneH) / 2;
  const lanes = roles.map((role, i) => ({
    ...createShape('frame', left, top0 + i * laneH),
    width: laneW,
    height: laneH,
    label: role,
    textAlignX: 'left' as const,
    textAlignY: 'middle' as const,
    padding: 'md' as const,
  }));
  const stepW = 130;
  const stepH = 56;
  const colX = (col: number) => left + 120 + col * 200;
  const laneCY = (i: number) => top0 + i * laneH + laneH / 2;
  const box = (label: string, col: number, lane: number, kind: ShapeKind = 'square') => ({
    ...createShape(kind, colX(col) - stepW / 2, laneCY(lane) - stepH / 2),
    width: stepW,
    height: stepH,
    label,
  });
  const order = box('Place order', 0, 0);
  const review = box('Review', 1, 1);
  const approve = {
    ...createShape('diamond', colX(2) - 60, laneCY(1) - 42),
    width: 120,
    height: 84,
    label: 'Approve?',
  };
  const ship = box('Ship', 3, 2);
  const arrows = [
    { ...createPinnedArrow(order.id, 's', review.id, 'n') },
    { ...createPinnedArrow(review.id, 'e', approve.id, 'w') },
    { ...createPinnedArrow(approve.id, 's', ship.id, 'n'), label: 'Yes' },
    // A rejected order loops back up to Review for rework, so the decision
    // reads as a real two-way branch rather than a dead end.
    {
      ...createPinnedArrow(approve.id, 'n', review.id, 'n'),
      label: 'No',
      arrowStyle: 'curved' as const,
      curveOffset: { dx: 0, dy: -60 },
    },
  ];
  return [...lanes, ...arrows, order, review, approve, ship];
}

// Decision tree (spec/09): a root question that branches yes / no, with one
// branch posing a further question — outcomes cascade downward.
function buildDecisionTree(cx: number, cy: number): Element[] {
  const dW = 130;
  const dH = 84;
  const bW = 130;
  const bH = 56;
  const top = cy - 190;
  // A realistic bug-triage decision so the structure reads as a real tree:
  // the No branch closes out, the Yes branch poses a follow-up question. Root's
  // two children sit symmetric about the centre (±180); the follow-up's own
  // children fan out to its right.
  const root = {
    ...createShape('diamond', cx - dW / 2, top),
    width: dW,
    height: dH,
    label: 'Bug valid?',
  };
  const a = {
    ...createShape('square', cx - 180 - bW / 2, top + 150),
    width: bW,
    height: bH,
    label: 'Close ticket',
  };
  const elseD = {
    ...createShape('diamond', cx + 180 - dW / 2, top + 150 - (dH - bH) / 2),
    width: dW,
    height: dH,
    label: 'Critical?',
  };
  const b = {
    ...createShape('square', cx + 70 - bW / 2, top + 320),
    width: bW,
    height: bH,
    label: 'Escalate now',
  };
  const c = {
    ...createShape('square', cx + 290 - bW / 2, top + 320),
    width: bW,
    height: bH,
    label: 'Add to backlog',
  };
  const arrows = [
    { ...createPinnedArrow(root.id, 'sw', a.id, 'n'), label: 'No' },
    { ...createPinnedArrow(root.id, 'se', elseD.id, 'n'), label: 'Yes' },
    { ...createPinnedArrow(elseD.id, 'sw', b.id, 'n'), label: 'Yes' },
    { ...createPinnedArrow(elseD.id, 'se', c.id, 'n'), label: 'No' },
  ];
  return [...arrows, root, a, elseD, b, c];
}

// Approval workflow (spec/09): Submit → Review → Approve?, branching to Done on
// yes and looping back to Submit on reject (a curved feedback edge below).
function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const w = 130;
  const h = 56;
  const gap = 190;
  const x0 = cx - 1.5 * gap;
  const submit = {
    ...createShape('stadium', x0 - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Submit',
  };
  const review = {
    ...createShape('square', x0 + gap - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Review',
  };
  const approve = {
    ...createShape('diamond', x0 + 2 * gap - 65, cy - 42),
    width: 130,
    height: 84,
    label: 'Approved?',
  };
  const done = {
    ...createShape('stadium', x0 + 3 * gap - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Done',
  };
  const arrows = [
    { ...createPinnedArrow(submit.id, 'e', review.id, 'w') },
    { ...createPinnedArrow(review.id, 'e', approve.id, 'w') },
    { ...createPinnedArrow(approve.id, 'e', done.id, 'w'), label: 'Yes' },
    {
      ...createPinnedArrow(approve.id, 's', submit.id, 's'),
      label: 'Reject',
      arrowStyle: 'curved' as const,
      curveOffset: { dx: 0, dy: 90 },
    },
  ];
  return [...arrows, submit, review, approve, done];
}

// Data flow diagram (spec/09): an external entity, a process (circle), a data
// store (cylinder) and an output, wired by labelled data flows.
function buildDataFlow(cx: number, cy: number): Element[] {
  const entity = {
    ...createShape('square', cx - 330, cy - 35),
    width: 120,
    height: 70,
    label: 'Customer',
  };
  const process = {
    ...createShape('circle', cx - 60, cy - 60),
    width: 120,
    height: 120,
    label: 'Process order',
  };
  const store = {
    ...createShape('cylinder', cx + 180, cy - 60),
    width: 120,
    height: 120,
    label: 'Orders',
  };
  // Centred directly under the process so the 'Invoice' flow drops straight
  // down (process spans cx-60..cx+60, centre cx).
  const output = {
    ...createShape('square', cx - 60, cy + 160),
    width: 120,
    height: 70,
    label: 'Invoice',
  };
  const arrows = [
    { ...createPinnedArrow(entity.id, 'e', process.id, 'w'), label: 'Order' },
    { ...createPinnedArrow(process.id, 'e', store.id, 'w'), label: 'Save' },
    { ...createPinnedArrow(process.id, 's', output.id, 'n'), label: 'Invoice' },
  ];
  return [...arrows, entity, process, store, output];
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
    label: 'Product launch',
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
      label: 'Research',
      from: 'e',
      to: 'w',
      leafSide: 'right',
      leafLabels: ['User interviews', 'Market analysis'],
    },
    {
      angle: 90,
      label: 'Design',
      from: 's',
      to: 'n',
      leafSide: 'below',
      leafLabels: ['Wireframes', 'Design system'],
    },
    {
      angle: 180,
      label: 'Build',
      from: 'w',
      to: 'e',
      leafSide: 'left',
      leafLabels: ['Frontend', 'API & data'],
    },
    {
      angle: 270,
      label: 'Launch',
      from: 'n',
      to: 's',
      leafSide: 'above',
      leafLabels: ['Marketing', 'Support docs'],
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
    label: 'Enter details',
    textSize: 'md' as const,
  };
  const decision = {
    ...createShape('diamond', cx - decW / 2, decisionY),
    width: decW,
    height: decH,
    label: 'Email valid?',
    textSize: 'md' as const,
  };
  const step2 = {
    ...createShape('square', cx - procW / 2, step2Y),
    width: procW,
    height: procH,
    label: 'Create account',
    textSize: 'md' as const,
  };
  const end = {
    ...createShape('stadium', cx - termW / 2, endY),
    width: termW,
    height: termH,
    label: 'End',
    textSize: 'md' as const,
  };
  // No branch: a step to the right of the decision that loops back up to
  // "Enter details" so the user can correct their input (a real reject loop).
  const sideStep = {
    ...createShape('square', cx + decW / 2 + 80, decisionY + decH / 2 - procH / 2),
    width: procW,
    height: procH,
    label: 'Show error',
    textSize: 'md' as const,
  };

  const arrows = [
    createPinnedArrow(start.id, 's', step1.id, 'n'),
    createPinnedArrow(step1.id, 's', decision.id, 'n'),
    { ...createPinnedArrow(decision.id, 's', step2.id, 'n'), label: 'Yes' },
    createPinnedArrow(step2.id, 's', end.id, 'n'),
    { ...createPinnedArrow(decision.id, 'e', sideStep.id, 'w'), label: 'No' },
    // Angled loop-back so the correction edge reads as an L rather than a
    // diagonal cutting across the decision.
    { ...createPinnedArrow(sideStep.id, 'n', step1.id, 'e'), arrowStyle: 'angled' as const },
  ];

  return [start, step1, decision, step2, sideStep, end, ...arrows];
}
