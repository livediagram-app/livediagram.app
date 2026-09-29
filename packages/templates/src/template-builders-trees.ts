import { createPinnedArrow, createShape, type Element } from '@livediagram/diagram';

// Org chart and flowchart template builders. Split out of
// template-builders.ts; each is pure (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md.
// The mind maps live in template-builders-mindmaps.ts.
export function buildOrgChart(cx: number, cy: number): Element[] {
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
    // Top of the org chart → strongest preset.
    colorPreset: 'bold',
  };

  const vpLabels = ['VP Engineering', 'VP Sales', 'VP Operations'];
  const vpXs = [cx - vpW / 2 - vpSpacing, cx - vpW / 2, cx - vpW / 2 + vpSpacing];
  const vps = vpLabels.map((label, i) => ({
    ...createShape('square', vpXs[i]!, vpY),
    width: vpW,
    height: vpH,
    label,
    textSize: 'sm' as const,
    // Second tier (VPs): a tint above the plain direct-report leaves.
    colorPreset: 'soft',
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
export function buildFlowchart(cx: number, cy: number): Element[] {
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
    // Entry terminator of the flow → strongest preset.
    colorPreset: 'bold',
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
    // The branch point is the decision worth highlighting → a gentle tint.
    colorPreset: 'soft',
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
