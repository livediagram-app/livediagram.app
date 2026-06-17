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
  createArrow,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
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
  const centerSize = 150;
  const bubbleSize = 100;
  const radius = 250;
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
    return { ...createShape('circle', bx, by), width: bubbleSize, height: bubbleSize, label };
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
function buildJourney(cx: number, cy: number): Element[] {
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
    });
    stickies.push({
      ...createSticky(x, stickyY),
      width: stickyW,
      height: stickyH,
      label: s.feeling,
      textSize: 'sm',
    });
  });
  // Connectors PINNED between adjacent stage cards, so they reflow when
  // the user repositions a stage rather than floating free.
  const arrows: Element[] = [];
  for (let i = 0; i < cards.length - 1; i++) {
    arrows.push(createPinnedArrow(cards[i]!.id, 'e', cards[i + 1]!.id, 'w'));
  }
  return [...cards, ...stickies, ...arrows];
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

  // Effect card at the head of the spine. A concrete problem statement
  // (rather than the literal word "Effect") shows what the four cause
  // categories are meant to explain; users swap it for their own.
  elements.push({
    ...createShape('square', spineRight, cy - effectH / 2),
    width: effectW,
    height: effectH,
    label: 'Late delivery',
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
