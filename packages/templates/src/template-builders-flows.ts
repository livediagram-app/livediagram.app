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

// Swimlane flowchart (spec/09): an order fulfilment process flowing across
// three role lanes. Lanes are frame containers (they paint behind their
// contents via framesFirst) with a DEDICATED label cell at the left edge —
// the old design put the role label mid-lane where the first process box
// overlapped it — so the flow area starts cleanly after the label gutter.
// The flow crosses lanes both downward (hand-offs) and back up (the
// delivery confirmation), with an out-of-stock detour that rejoins the
// happy path, so the template demonstrates every swimlane idiom: hand-off,
// branch, rejoin, and round trip.
export function buildSwimlane(cx: number, cy: number): Element[] {
  const roles = ['Customer', 'Sales', 'Warehouse'];
  const labelW = 150;
  const laneW = 1230;
  const laneH = 170;
  // Lanes sit slightly apart: flush frames doubled their borders into a
  // heavier line with a hairline sliver between (the old design's visual
  // glitch), while a deliberate gap reads as three clean bands.
  const laneGap = 14;
  const left = cx - laneW / 2;
  const top0 = cy - (roles.length * laneH + (roles.length - 1) * laneGap) / 2;
  const laneTop = (i: number) => top0 + i * (laneH + laneGap);
  const lanes = roles.map((_, i) => ({
    ...createShape('frame', left, laneTop(i)),
    width: laneW,
    height: laneH,
    // createShape defaults frames to a "Frame" section title; the role
    // lives in the gutter cell instead, so blank the frame's own label.
    label: '',
  }));
  // Role labels live in their own gutter cells so no step can overlap them.
  const labels = roles.map((role, i) => ({
    ...createShape('square', left, laneTop(i)),
    width: labelW,
    height: laneH,
    label: role,
    textSize: 'md' as const,
    // A muted tint separates the gutter from the flow area.
    colorPreset: 'muted',
  }));
  const stepW = 140;
  const stepH = 60;
  const colX = (col: number) => left + labelW + 100 + col * 180;
  const laneCY = (i: number) => laneTop(i) + laneH / 2;
  const box = (label: string, col: number, lane: number, kind: ShapeKind = 'square') => ({
    ...createShape(kind, colX(col) - stepW / 2, laneCY(lane) - stepH / 2),
    width: stepW,
    height: stepH,
    label,
  });
  // Entry step of the process → strongest preset so the flow's start reads.
  const order = { ...box('Place order', 0, 0, 'stadium'), colorPreset: 'bold' };
  const review = box('Review order', 1, 1);
  const inStock = {
    ...createShape('diamond', colX(2) - 65, laneCY(1) - 42),
    width: 130,
    height: 84,
    label: 'In stock?',
    // The decision gate → a tint highlights the branch point.
    colorPreset: 'soft',
  };
  // The out-of-stock detour sits directly below the gate in the Warehouse
  // lane, then rejoins the happy path at Pick & pack.
  const restock = {
    ...box('Restock', 2, 2),
    // Exception path → outline preset (the state machine's Cancelled idiom).
    colorPreset: 'outline',
  };
  const pick = box('Pick & pack', 3, 2);
  const ship = box('Ship order', 4, 2);
  const delivered = box('Order delivered', 5, 0, 'stadium');
  const arrows = [
    { ...createPinnedArrow(order.id, 's', review.id, 'n') },
    { ...createPinnedArrow(review.id, 'e', inStock.id, 'w') },
    { ...createPinnedArrow(inStock.id, 'e', pick.id, 'n'), label: 'Yes' },
    { ...createPinnedArrow(inStock.id, 's', restock.id, 'n'), label: 'No' },
    // The detour rejoins the happy path once stock lands.
    { ...createPinnedArrow(restock.id, 'e', pick.id, 'w') },
    { ...createPinnedArrow(pick.id, 'e', ship.id, 'w') },
    // The confirmation crosses back up to the Customer lane, closing the
    // round trip the process started with.
    { ...createPinnedArrow(ship.id, 'e', delivered.id, 's'), label: 'Notify' },
  ];
  return [...lanes, ...labels, ...arrows, order, review, inStock, restock, pick, ship, delivered];
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

// Approval workflow (spec/09): a two-stage sign-off with rework as a
// first-class step. Submit request → Manager review → Approved? gates the
// main row; Yes carries on through Finance sign-off to Done, No drops to a
// Request changes step below whose edge loops back to Submit — so a
// rejection visibly costs a rework pass rather than vanishing into a bare
// curved edge. Presets follow the house grammar: entry bold, the gate soft,
// the exception path outlined (the state machine's Cancelled idiom).
export function buildApprovalWorkflow(cx: number, cy: number): Element[] {
  const w = 150;
  const h = 60;
  const gap = 200;
  const x0 = cx - 2 * gap;
  const submit = {
    ...createShape('stadium', x0 - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Submit request',
    // Entry point of the workflow → strongest preset.
    colorPreset: 'bold',
  };
  const review = {
    ...createShape('square', x0 + gap - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Manager review',
  };
  const approve = {
    ...createShape('diamond', x0 + 2 * gap - 70, cy - 44),
    width: 140,
    height: 88,
    label: 'Approved?',
    // The approval gate is the pivotal step → a tint draws the eye to it.
    colorPreset: 'soft',
  };
  const signOff = {
    ...createShape('square', x0 + 3 * gap - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Finance approval',
  };
  const done = {
    ...createShape('stadium', x0 + 4 * gap - w / 2, cy - h / 2),
    width: w,
    height: h,
    label: 'Done',
  };
  // Rework sits below the gate, halfway back toward Review, so the reject
  // loop reads as a real detour: down, across, and back into the queue.
  const rework = {
    ...createShape('square', x0 + 1.5 * gap - w / 2, cy + 150 - h / 2),
    width: w,
    height: h,
    label: 'Request changes',
    // Exception path → outline preset, the same grammar as the state
    // machine's Cancelled state.
    colorPreset: 'outline',
  };
  const arrows = [
    { ...createPinnedArrow(submit.id, 'e', review.id, 'w') },
    { ...createPinnedArrow(review.id, 'e', approve.id, 'w') },
    { ...createPinnedArrow(approve.id, 'e', signOff.id, 'w'), label: 'Yes' },
    { ...createPinnedArrow(signOff.id, 'e', done.id, 'w') },
    { ...createPinnedArrow(approve.id, 's', rework.id, 'e'), label: 'No' },
    {
      ...createPinnedArrow(rework.id, 'w', submit.id, 's'),
      label: 'Revise & resubmit',
      arrowStyle: 'curved' as const,
      curveOffset: { dx: -40, dy: 40 },
    },
  ];
  return [...arrows, submit, review, approve, signOff, done, rework];
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
