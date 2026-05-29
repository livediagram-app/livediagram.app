import {
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/diagram';

export type TemplateKind = 'blank' | 'mindmap' | 'orgchart' | 'retrospective' | 'flowchart';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank diagram',
    description: 'An empty canvas to start with whatever you like.',
  },
  {
    kind: 'mindmap',
    title: 'Mind map',
    description: 'A central idea with branching topics around it.',
  },
  {
    kind: 'orgchart',
    title: 'Org chart',
    description: 'A simple hierarchy: leader with direct reports.',
  },
  {
    kind: 'retrospective',
    title: 'Retrospective',
    description: '"What went well", "What didn\'t", "Action items".',
  },
  {
    kind: 'flowchart',
    title: 'Flowchart',
    description: 'Start → step → decision → end, with a branching path.',
  },
];

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
  const centerSize = 140;
  const branchW = 120;
  const branchH = 70;
  const radius = 220;

  const center = {
    ...createShape('circle', cx - centerSize / 2, cy - centerSize / 2),
    width: centerSize,
    height: centerSize,
    label: 'Main idea',
    textSize: 'lg' as const,
  };

  const branches: { angle: number; label: string; from: Anchor; to: Anchor }[] = [
    { angle: 0, label: 'Topic 1', from: 'e', to: 'w' },
    { angle: 90, label: 'Topic 2', from: 's', to: 'n' },
    { angle: 180, label: 'Topic 3', from: 'w', to: 'e' },
    { angle: 270, label: 'Topic 4', from: 'n', to: 's' },
  ];

  const branchElements = branches.map(({ angle, label }) => {
    const rad = (angle * Math.PI) / 180;
    const bx = cx + Math.cos(rad) * radius - branchW / 2;
    const by = cy + Math.sin(rad) * radius - branchH / 2;
    return {
      ...createShape('circle', bx, by),
      width: branchW,
      height: branchH,
      label,
      textSize: 'md' as const,
    };
  });

  const arrows = branches.map((b, i) =>
    createPinnedArrow(center.id, b.from, branchElements[i]!.id, b.to),
  );

  return [center, ...branchElements, ...arrows];
}

function buildOrgChart(cx: number, cy: number): Element[] {
  const headW = 180;
  const headH = 70;
  const vpW = 150;
  const vpH = 54;
  const subW = 120;
  const subH = 46;

  const ceoY = cy - 200;
  const vpY = cy - 40;
  const subY = cy + 120;

  const head = {
    ...createShape('square', cx - headW / 2, ceoY),
    width: headW,
    height: headH,
    label: 'CEO',
    textSize: 'lg' as const,
  };

  const vpLabels = ['VP Engineering', 'VP Sales', 'VP Operations'];
  const vpXs = [cx - vpW * 1.7, cx - vpW / 2, cx + vpW * 0.7];
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
    const leftCenter = vpCenterX - 65;
    const rightCenter = vpCenterX + 65;
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
  const termW = 160;
  const termH = 60;
  const procW = 140;
  const procH = 64;
  const decW = 140;
  const decH = 90;
  const vGap = 32;

  const startY = cy - 260;
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

function buildRetrospective(cx: number, cy: number): Element[] {
  const colW = 260;
  const colSpacing = 280;
  const headerH = 56;
  const stickyH = 110;
  const stickyGap = 20;
  const columns = ['What went well', "What didn't go well", 'Action items'];
  const firstColX = cx - colSpacing - colW / 2;

  const elements: Element[] = [];
  for (let i = 0; i < columns.length; i++) {
    const x = firstColX + i * colSpacing;
    const headerY = cy - 240;
    elements.push({
      ...createText(x, headerY),
      width: colW,
      height: headerH,
      label: columns[i]!,
      textSize: 'lg',
      textAlignX: 'center',
    });
    for (let j = 0; j < 3; j++) {
      const stickyY = headerY + headerH + 24 + j * (stickyH + stickyGap);
      elements.push({
        ...createSticky(x, stickyY),
        width: colW,
        height: stickyH,
        textSize: 'sm',
      });
    }
  }
  return elements;
}
