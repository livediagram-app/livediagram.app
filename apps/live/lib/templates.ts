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
import { getTheme, type ThemeId } from './themes';

export type TemplateKind =
  | 'blank'
  | 'mindmap'
  | 'orgchart'
  | 'retrospective'
  | 'flowchart'
  | 'kanban'
  | 'swot'
  | 'timeline';

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
  {
    kind: 'kanban',
    title: 'Kanban',
    description: 'Three columns: To do, In progress, Done — with starter cards.',
  },
  {
    kind: 'swot',
    title: 'SWOT',
    description: 'Strengths, Weaknesses, Opportunities, Threats — 2×2 grid.',
  },
  {
    kind: 'timeline',
    title: 'Timeline',
    description: 'Horizontal line with milestone markers, above + below.',
  },
];

// Build a fully-themed starter tab for /live/new. Centres the
// template's scaffold on (0, 0), recolours shape / text / arrow
// elements with the chosen theme (sticky notes keep their amber
// palette), and attaches the theme's backdrop fields to the tab so
// the editor lands on a fully styled canvas. Mirrors the
// `chooseTemplate` path inside the editor route.
export function buildTemplatedTab(
  kind: TemplateKind,
  themeId: ThemeId,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  const rawElements = buildTemplate(kind, 0, 0);
  const elements = rawElements.map((el) => {
    if (el.type === 'shape') {
      return {
        ...el,
        ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
        ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
        ...(theme.elementText ? { textColor: theme.elementText } : {}),
      };
    }
    if (el.type === 'text') {
      return {
        ...el,
        ...(theme.elementText ? { textColor: theme.elementText } : {}),
      };
    }
    if (el.type === 'arrow') {
      return {
        ...el,
        ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      };
    }
    return el;
  });
  return {
    id: tabId,
    name: tabName,
    elements,
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    templateChosen: true,
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
  const branchW = 130;
  const branchH = 60;
  const leafW = 100;
  const leafH = 44;
  const branchRadius = 240;
  const leafOffset = 160;

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
    const spread = 32;
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

// Classic "Mad / Sad / Glad" retro. Each column lives inside its own
// tinted container shape (red / blue / green) so the framework's
// emotional groupings read at a glance. Header text + three sticky
// notes sit on top of the container; the container is the first
// element pushed per column so subsequent label + sticky elements
// render above it.
function buildRetrospective(cx: number, cy: number): Element[] {
  const containerW = 300;
  const containerSpacing = 320;
  const colW = 260;
  const headerH = 56;
  const stickyH = 110;
  const stickyGap = 20;
  const topPadding = 16;
  const headerGap = 16;
  const bottomPadding = 16;
  const containerH = topPadding + headerH + headerGap + 3 * stickyH + 2 * stickyGap + bottomPadding;

  const columns: { label: string; fill: string; stroke: string }[] = [
    { label: 'Mad', fill: '#fee2e2', stroke: '#fca5a5' },
    { label: 'Sad', fill: '#dbeafe', stroke: '#93c5fd' },
    { label: 'Glad', fill: '#dcfce7', stroke: '#86efac' },
  ];

  const firstColCenterX = cx - containerSpacing;
  const containerY = cy - containerH / 2 + 40;

  const elements: Element[] = [];
  columns.forEach((col, i) => {
    const centerX = firstColCenterX + i * containerSpacing;
    const containerX = centerX - containerW / 2;

    elements.push({
      ...createShape('square', containerX, containerY),
      width: containerW,
      height: containerH,
      fillColor: col.fill,
      strokeColor: col.stroke,
      textSize: 'md',
    });

    const innerX = centerX - colW / 2;
    const headerY = containerY + topPadding;
    elements.push({
      ...createText(innerX, headerY),
      width: colW,
      height: headerH,
      label: col.label,
      textSize: 'lg',
      textAlignX: 'center',
    });

    for (let j = 0; j < 3; j++) {
      const stickyY = headerY + headerH + headerGap + j * (stickyH + stickyGap);
      elements.push({
        ...createSticky(innerX, stickyY),
        width: colW,
        height: stickyH,
        textSize: 'sm',
      });
    }
  });

  return elements;
}

// Three-column Kanban board with starter cards in each lane. Same
// container-around-column treatment as Retrospective so each lane reads
// as a distinct zone; cards are squares (not stickies) since Kanban
// vocabulary leans more "task ticket" than "thought".
function buildKanban(cx: number, cy: number): Element[] {
  const containerW = 280;
  const containerSpacing = 300;
  const cardW = 240;
  const cardH = 56;
  const headerH = 48;
  const topPadding = 16;
  const headerGap = 12;
  const cardGap = 12;
  const cardsPerCol = 3;
  const containerH =
    topPadding + headerH + headerGap + cardsPerCol * cardH + (cardsPerCol - 1) * cardGap + 16;

  const columns: { label: string; fill: string; stroke: string }[] = [
    { label: 'To do', fill: '#f1f5f9', stroke: '#cbd5e1' },
    { label: 'In progress', fill: '#dbeafe', stroke: '#93c5fd' },
    { label: 'Done', fill: '#dcfce7', stroke: '#86efac' },
  ];
  const firstColCenterX = cx - containerSpacing;
  const containerY = cy - containerH / 2 + 40;

  const elements: Element[] = [];
  columns.forEach((col, i) => {
    const centerX = firstColCenterX + i * containerSpacing;
    const containerX = centerX - containerW / 2;
    elements.push({
      ...createShape('square', containerX, containerY),
      width: containerW,
      height: containerH,
      fillColor: col.fill,
      strokeColor: col.stroke,
      textSize: 'md',
    });
    const innerX = centerX - cardW / 2;
    const headerY = containerY + topPadding;
    elements.push({
      ...createText(innerX, headerY),
      width: cardW,
      height: headerH,
      label: col.label,
      textSize: 'lg',
      textAlignX: 'center',
    });
    for (let j = 0; j < cardsPerCol; j++) {
      const y = headerY + headerH + headerGap + j * (cardH + cardGap);
      elements.push({
        ...createShape('square', innerX, y),
        width: cardW,
        height: cardH,
        label: 'Card',
        textSize: 'md',
      });
    }
  });
  return elements;
}

// SWOT 2×2 grid. Strengths / Weaknesses / Opportunities / Threats live
// in tinted containers (green / orange / blue / red) that match the
// emotional weighting of each quadrant.
function buildSwot(cx: number, cy: number): Element[] {
  const cellW = 260;
  const cellH = 200;
  const gap = 16;
  const labelH = 36;

  const quadrants: { label: string; col: 0 | 1; row: 0 | 1; fill: string; stroke: string }[] = [
    { label: 'Strengths', col: 0, row: 0, fill: '#dcfce7', stroke: '#86efac' },
    { label: 'Weaknesses', col: 1, row: 0, fill: '#fee2e2', stroke: '#fca5a5' },
    { label: 'Opportunities', col: 0, row: 1, fill: '#dbeafe', stroke: '#93c5fd' },
    { label: 'Threats', col: 1, row: 1, fill: '#fef3c7', stroke: '#fcd34d' },
  ];

  const elements: Element[] = [];
  for (const q of quadrants) {
    const x = cx - cellW - gap / 2 + q.col * (cellW + gap);
    const y = cy - cellH - gap / 2 + q.row * (cellH + gap);
    elements.push({
      ...createShape('square', x, y),
      width: cellW,
      height: cellH,
      fillColor: q.fill,
      strokeColor: q.stroke,
      textSize: 'md',
    });
    elements.push({
      ...createText(x + 12, y + 12),
      width: cellW - 24,
      height: labelH,
      label: q.label,
      textSize: 'lg',
      textAlignX: 'left',
    });
  }
  return elements;
}

// Horizontal timeline with 5 milestone markers — circles on the line,
// alternating labels above and below so they don't crowd. Labels are
// simple Text elements (no underlying card) so the chart reads cleanly.
function buildTimeline(cx: number, cy: number): Element[] {
  const lineLength = 720;
  const milestoneRadius = 14;
  const labelW = 140;
  const labelH = 36;
  const verticalOffset = 56;

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

  const milestones = ['Kick-off', 'Phase 1', 'Phase 2', 'Phase 3', 'Launch'];
  const above = (i: number) => i % 2 === 0;
  milestones.forEach((label, i) => {
    const x = startX + ((i + 0.5) / milestones.length) * lineLength;
    elements.push({
      ...createShape('circle', x - milestoneRadius, baseY - milestoneRadius),
      width: milestoneRadius * 2,
      height: milestoneRadius * 2,
      textSize: 'sm',
    });
    elements.push({
      ...createText(
        x - labelW / 2,
        above(i) ? baseY - verticalOffset : baseY + verticalOffset - labelH,
      ),
      width: labelW,
      height: labelH,
      label,
      textSize: 'md',
      textAlignX: 'center',
    });
  });
  return elements;
}
