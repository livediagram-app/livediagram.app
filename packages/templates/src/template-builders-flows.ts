import {
  bestAnchorTowards,
  createPinnedArrow,
  createShape,
  type Element,
  type ShapeKind,
} from '@livediagram/diagram';

// Mind-map-tree / bubble-map + process-style template builders (swimlane,
// decision tree, approval workflow, data flow). Split out of template-
// builders.ts; each is pure (cx, cy) -> Element[]. See spec/09.
export function buildBlank(): Element[] {
  return [];
}

// Tree mind map (spec/09): a left-to-right hierarchy — root, a vertical stack
// of branches, and one leaf per branch — connected by plain lines. Distinct
// from the radial 'mindmap' for users who think in outlines.
export function buildMindMapTree(cx: number, cy: number): Element[] {
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
    // Root of the tree → strongest preset so the topic anchors the outline.
    colorPreset: 'bold',
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
    // First-level branches: a gentle tint sits below the bold root, above
    // the plain leaves — a legible three-tier hierarchy.
    colorPreset: 'soft',
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
export function buildBubbleMap(cx: number, cy: number): Element[] {
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
    // Central topic of the bubble map → hero preset.
    colorPreset: 'bold',
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
export function buildSwimlane(cx: number, cy: number): Element[] {
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
  // Entry step of the process → strongest preset so the flow's start reads.
  const order = { ...box('Place order', 0, 0), colorPreset: 'bold' };
  const review = box('Review', 1, 1);
  const approve = {
    ...createShape('diamond', colX(2) - 60, laneCY(1) - 42),
    width: 120,
    height: 84,
    label: 'Approve?',
    // The decision gate → a tint highlights the branch point.
    colorPreset: 'soft',
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
export function buildDecisionTree(cx: number, cy: number): Element[] {
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
    // Root question of the tree → strongest preset.
    colorPreset: 'bold',
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
    // The follow-up decision: a tint marks it as the second-level question.
    colorPreset: 'soft',
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
export function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const w = 130;
  const h = 56;
  const gap = 190;
  const x0 = cx - 1.5 * gap;
  const submit = {
    ...createShape('stadium', x0 - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Submit',
    // Entry point of the workflow → strongest preset.
    colorPreset: 'bold',
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
    // The approval gate is the pivotal step → a tint draws the eye to it.
    colorPreset: 'soft',
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
export function buildDataFlow(cx: number, cy: number): Element[] {
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
    // The process is the heart of a data-flow diagram → hero preset.
    colorPreset: 'bold',
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
