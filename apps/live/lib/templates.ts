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
  | 'timeline'
  | 'venn'
  | 'journey'
  | 'fishbone'
  | 'pyramid'
  // UI wireframes (use the device-frame shapes added in spec/09's
  // Devices accordion). Sit under "Show more" because they're
  // situational starters for design / product work.
  | 'mobile-wireframe'
  | 'laptop-wireframe'
  | 'slide-deck'
  // A growth / momentum flywheel: hub + four sectors with a clockwise
  // arrow loop. Sits under "Show more" alongside the other strategy /
  // wireframing starters.
  | 'flywheel';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // True for templates that sit behind the picker's "Show more"
  // toggle. Default templates render in the first batch; extras
  // unlock on click so the grid stays compact for first-time users.
  extra?: boolean;
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
    description: 'Five lanes from Backlog to Done, with ticket cards and priority chips.',
  },
  {
    kind: 'swot',
    title: 'SWOT',
    description: 'Spacious 2×2 with bullet starters in each quadrant and a centre subject.',
  },
  {
    kind: 'timeline',
    title: 'Timeline',
    description: 'Horizontal line with milestone markers, above + below.',
  },
  {
    kind: 'venn',
    title: 'Venn diagram',
    description: 'Three overlapping sets with shared and exclusive labels.',
    extra: true,
  },
  {
    kind: 'journey',
    title: 'User journey',
    description: 'Stages a user moves through, with feeling notes below each.',
    extra: true,
  },
  {
    kind: 'fishbone',
    title: 'Fishbone',
    description: 'Cause-and-effect spine with four contributing categories.',
    extra: true,
  },
  {
    kind: 'pyramid',
    title: 'Pyramid',
    description: 'Four stacked tiers — foundation at the bottom, peak on top.',
    extra: true,
  },
  {
    kind: 'mobile-wireframe',
    title: 'Mobile wireframe',
    description: 'Three phone screens side by side: a user-flow starter for mobile UI work.',
    extra: true,
  },
  {
    kind: 'laptop-wireframe',
    title: 'Laptop wireframe',
    description:
      'A laptop frame with header, sidebar and content placeholders for desktop UI work.',
    extra: true,
  },
  {
    kind: 'slide-deck',
    title: 'Slide deck',
    description: 'Four blank slides in a 2 by 2 grid, like a short PowerPoint outline.',
    extra: true,
  },
  {
    kind: 'flywheel',
    title: 'Flywheel',
    description:
      'A central momentum hub with four reinforcing stages and a clockwise loop of arrows.',
    extra: true,
  },
];

// Optional canvas-level overrides a specific template can request
// on top of whatever theme is applied — soft-edits to backdrop
// fields that ship with the template. Today only Mind map uses this
// (the radiating branches read better against a slightly softened
// canvas). Generalises if other templates want their own tuning.
export function templateCanvasOverrides(kind: TemplateKind): Partial<Tab> {
  if (kind === 'mindmap') return { backgroundOpacity: 0.8 };
  return {};
}

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

// Classic "Mad / Sad / Glad" retro. Each column lives inside its own
// tinted container shape (red / blue / green) so the framework's
// emotional groupings read at a glance. Header text + three sticky
// notes sit on top of the container; the container is the first
// element pushed per column so subsequent label + sticky elements
// render above it.
function buildRetrospective(cx: number, cy: number): Element[] {
  const containerW = 460;
  const containerSpacing = 500;
  const colW = 400;
  const headerH = 80;
  const stickyH = 170;
  const stickyGap = 28;
  const topPadding = 24;
  const headerGap = 24;
  const bottomPadding = 24;
  const stickiesPerColumn = 5;
  const containerH =
    topPadding +
    headerH +
    headerGap +
    stickiesPerColumn * stickyH +
    (stickiesPerColumn - 1) * stickyGap +
    bottomPadding;

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

    for (let j = 0; j < stickiesPerColumn; j++) {
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

// Five-column Kanban board (Backlog / To do / In progress / Review /
// Done) with realistic ticket-shaped cards in each lane. Each card is
// two stacked elements: a header square holding the ticket title and a
// narrower chip square below it carrying a priority tint (rose = high,
// amber = medium, sky = low). The chip is a separate element rather
// than a single label so users can edit/recolour priority without
// retyping the title — closer to how teams actually wrangle a board.
//
// The board title above the columns gives the diagram an anchor and
// also acts as natural "rename me" affordance the first time a user
// opens the template.
function buildKanban(cx: number, cy: number): Element[] {
  const containerW = 360;
  const containerSpacing = 400;
  const cardW = 310;
  const cardTitleH = 80;
  const cardChipH = 28;
  const cardBlockH = cardTitleH + cardChipH;
  const headerH = 64;
  const topPadding = 24;
  const headerGap = 24;
  const cardGap = 18;
  const cardsPerCol = 4;
  const containerH =
    topPadding + headerH + headerGap + cardsPerCol * cardBlockH + (cardsPerCol - 1) * cardGap + 24;

  type Priority = 'high' | 'med' | 'low';
  const priorityStyle: Record<Priority, { fill: string; stroke: string; label: string }> = {
    high: { fill: '#fee2e2', stroke: '#fca5a5', label: 'High priority' },
    med: { fill: '#fef3c7', stroke: '#fcd34d', label: 'Medium' },
    low: { fill: '#e0e7ff', stroke: '#a5b4fc', label: 'Low' },
  };

  const columns: {
    label: string;
    fill: string;
    stroke: string;
    cards: { title: string; priority: Priority }[];
  }[] = [
    {
      label: 'Backlog',
      fill: '#f1f5f9',
      stroke: '#cbd5e1',
      cards: [
        { title: 'Research competitors', priority: 'low' },
        { title: 'Define MVP scope', priority: 'high' },
        { title: 'Draft landing copy', priority: 'med' },
        { title: 'User interviews', priority: 'med' },
      ],
    },
    {
      label: 'To do',
      fill: '#e2e8f0',
      stroke: '#94a3b8',
      cards: [
        { title: 'Build auth flow', priority: 'high' },
        { title: 'Wire payments', priority: 'high' },
        { title: 'Design dashboard', priority: 'med' },
        { title: 'Set up CI pipeline', priority: 'low' },
      ],
    },
    {
      label: 'In progress',
      fill: '#dbeafe',
      stroke: '#93c5fd',
      cards: [
        { title: 'Editor toolbar', priority: 'high' },
        { title: 'Drag and drop reorder', priority: 'med' },
        { title: 'Save endpoint', priority: 'high' },
        { title: 'Theme picker', priority: 'low' },
      ],
    },
    {
      label: 'Review',
      fill: '#f3e8ff',
      stroke: '#c4b5fd',
      cards: [
        { title: 'Export to PNG', priority: 'med' },
        { title: 'Share dialog', priority: 'med' },
        { title: 'Templates panel', priority: 'low' },
        { title: 'Settings page', priority: 'low' },
      ],
    },
    {
      label: 'Done',
      fill: '#dcfce7',
      stroke: '#86efac',
      cards: [
        { title: 'Repo bootstrap', priority: 'low' },
        { title: 'Brand palette', priority: 'low' },
        { title: 'Static landing', priority: 'med' },
        { title: 'MIT license', priority: 'low' },
      ],
    },
  ];

  // Centre the 5-column block on cx by offsetting from the middle column.
  const middleIndex = (columns.length - 1) / 2;
  const titleH = 56;
  const titleGap = 28;
  const containerY = cy - containerH / 2 + titleH / 2 + titleGap / 2;
  const boardTitleY = containerY - titleH - titleGap;

  const elements: Element[] = [];

  // Board title spans roughly the full board width so it visually
  // anchors the columns underneath rather than floating loose.
  const boardTitleW = columns.length * containerSpacing - (containerSpacing - containerW);
  elements.push({
    ...createText(cx - boardTitleW / 2, boardTitleY),
    width: boardTitleW,
    height: titleH,
    label: 'Sprint board',
    textSize: 'lg',
    textAlignX: 'center',
  });

  columns.forEach((col, i) => {
    const centerX = cx + (i - middleIndex) * containerSpacing;
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
      label: `${col.label} · ${col.cards.length}`,
      textSize: 'lg',
      textAlignX: 'center',
    });

    col.cards.forEach((card, j) => {
      const blockY = headerY + headerH + headerGap + j * (cardBlockH + cardGap);
      const priority = priorityStyle[card.priority];

      // Card title (white card body)
      elements.push({
        ...createShape('square', innerX, blockY),
        width: cardW,
        height: cardTitleH,
        label: card.title,
        fillColor: '#ffffff',
        strokeColor: '#e2e8f0',
        textSize: 'md',
      });

      // Priority chip glued to the card's bottom edge — a thinner
      // strip so the title still dominates visually.
      elements.push({
        ...createShape('square', innerX, blockY + cardTitleH),
        width: cardW,
        height: cardChipH,
        label: priority.label,
        fillColor: priority.fill,
        strokeColor: priority.stroke,
        textSize: 'sm',
      });
    });
  });
  return elements;
}

// SWOT 2×2 grid sized to give each quadrant real working room, with
// a subject pill in the middle (the thing being analysed) and 3
// starter bullets per quadrant the user can swap for their own.
// Quadrant tints follow the conventional emotional weighting —
// Strengths green / Opportunities blue (positives), Weaknesses red /
// Threats amber (concerns). Each bullet is its own Text element so
// users can move/delete individual lines without breaking the
// scaffold.
function buildSwot(cx: number, cy: number): Element[] {
  const cellW = 560;
  const cellH = 440;
  const gap = 28;
  const headerH = 64;
  const headerPadding = 20;
  const bulletGap = 14;
  const bulletH = 56;
  const subjectW = 220;
  const subjectH = 64;

  const quadrants: {
    label: string;
    col: 0 | 1;
    row: 0 | 1;
    fill: string;
    stroke: string;
    headerColor: string;
    bullets: string[];
  }[] = [
    {
      label: 'Strengths',
      col: 0,
      row: 0,
      fill: '#dcfce7',
      stroke: '#86efac',
      headerColor: '#15803d',
      bullets: ['Strong brand recognition', 'Loyal customer base', 'Proven, profitable product'],
    },
    {
      label: 'Weaknesses',
      col: 1,
      row: 0,
      fill: '#fee2e2',
      stroke: '#fca5a5',
      headerColor: '#b91c1c',
      bullets: ['Limited geographic reach', 'High operational costs', 'Slow product delivery'],
    },
    {
      label: 'Opportunities',
      col: 0,
      row: 1,
      fill: '#dbeafe',
      stroke: '#93c5fd',
      headerColor: '#1d4ed8',
      bullets: ['Expand to new markets', 'Strategic partnerships', 'Emerging tech trends'],
    },
    {
      label: 'Threats',
      col: 1,
      row: 1,
      fill: '#fef3c7',
      stroke: '#fcd34d',
      headerColor: '#a16207',
      bullets: ['Aggressive competitors', 'Regulatory changes', 'Economic downturn'],
    },
  ];

  const elements: Element[] = [];
  for (const q of quadrants) {
    const x = cx - cellW - gap / 2 + q.col * (cellW + gap);
    const y = cy - cellH - gap / 2 + q.row * (cellH + gap);

    // Quadrant container
    elements.push({
      ...createShape('square', x, y),
      width: cellW,
      height: cellH,
      fillColor: q.fill,
      strokeColor: q.stroke,
      textSize: 'md',
    });

    // Header label rendered in the matching deeper hue so each
    // quadrant has visual weight from across the canvas.
    elements.push({
      ...createText(x + headerPadding, y + headerPadding),
      width: cellW - headerPadding * 2,
      height: headerH,
      label: q.label,
      textSize: 'lg',
      textAlignX: 'left',
      textColor: q.headerColor,
    });

    // Starter bullets sit under the header. Width matches the header
    // so the text rail aligns crisply down the quadrant's left edge.
    q.bullets.forEach((bullet, i) => {
      elements.push({
        ...createText(
          x + headerPadding,
          y + headerPadding + headerH + bulletGap + i * (bulletH + bulletGap),
        ),
        width: cellW - headerPadding * 2,
        height: bulletH,
        label: `• ${bullet}`,
        textSize: 'md',
        textAlignX: 'left',
      });
    });
  }

  // Subject pill at the centre — sits on top of the quadrants at the
  // grid's intersection so the analysis subject is visible at a
  // glance without scanning each cell.
  elements.push({
    ...createShape('circle', cx - subjectW / 2, cy - subjectH / 2),
    width: subjectW,
    height: subjectH,
    label: 'Subject',
    fillColor: '#ffffff',
    strokeColor: '#475569',
    textSize: 'lg',
  });

  return elements;
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

// Mobile wireframe: three phone frames in a row, each labelled with a
// screen name. Starter for the typical user-flow exercise: figure out
// the screens you need, then draw them. Phones are 100×190 here (a
// touch wider than the create-default 90×170 so the labels read
// comfortably). Spacing leaves enough room between them for arrow
// flow between screens once the user adds connectors.
function buildMobileWireframe(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const phoneW = 160;
  const phoneH = 320;
  const gap = 80;
  const screenCount = 3;
  const totalW = screenCount * phoneW + (screenCount - 1) * gap;
  const startX = cx - totalW / 2;
  const phoneY = cy - phoneH / 2;
  const screenInsetX = 12;
  const screenInsetTop = 26;
  const screenInsetBottom = 22;
  const innerW = phoneW - screenInsetX * 2;

  // Per-screen scaffold: status strip + header band + a stack of
  // screen-specific content blocks + a bottom tab bar. Drops users
  // into a recognisable mobile UI shell rather than three empty
  // device frames.
  const buildScreen = (
    label: 'Login' | 'Feed' | 'Profile',
    x: number,
  ): { phone: Element; inner: Element[] } => {
    const phone = {
      ...createShape('phone', x, phoneY),
      width: phoneW,
      height: phoneH,
      label,
      textSize: 'sm' as const,
      textAlignY: 'top' as const,
    };
    const inner: Element[] = [];
    const innerX = x + screenInsetX;
    const screenTop = phoneY + screenInsetTop;
    const tabBarH = 28;
    const tabBarY = phoneY + phoneH - screenInsetBottom - tabBarH;

    // Status strip across the top of the screen area.
    inner.push({
      ...createShape('square', innerX, screenTop),
      width: innerW,
      height: 10,
    });

    if (label === 'Login') {
      // Logo + headline, two input fields, a primary button, a
      // small "forgot password" text strip beneath.
      inner.push({
        ...createShape('circle', innerX + innerW / 2 - 18, screenTop + 30),
        width: 36,
        height: 36,
      });
      inner.push({
        ...createShape('square', innerX + 16, screenTop + 80),
        width: innerW - 32,
        height: 16,
        label: 'Welcome back',
        textSize: 'sm',
      });
      inner.push({
        ...createShape('square', innerX + 8, screenTop + 116),
        width: innerW - 16,
        height: 26,
        label: 'Email',
        textSize: 'sm',
        textAlignX: 'left',
      });
      inner.push({
        ...createShape('square', innerX + 8, screenTop + 152),
        width: innerW - 16,
        height: 26,
        label: 'Password',
        textSize: 'sm',
        textAlignX: 'left',
      });
      inner.push({
        ...createShape('stadium', innerX + 8, screenTop + 196),
        width: innerW - 16,
        height: 30,
        label: 'Sign in',
        textSize: 'sm',
      });
      inner.push({
        ...createShape('square', innerX + innerW / 2 - 50, screenTop + 236),
        width: 100,
        height: 14,
        label: 'Forgot password?',
        textSize: 'sm',
      });
    } else if (label === 'Feed') {
      // Title strip + three stacked content cards. Each card has
      // a thumbnail dot + two strip rows underneath. Reads as the
      // skeleton of a content list.
      inner.push({
        ...createShape('square', innerX + 8, screenTop + 18),
        width: innerW - 16,
        height: 20,
        label: 'Feed',
        textSize: 'sm',
        textAlignX: 'left',
      });
      [0, 1, 2].forEach((row) => {
        const cardY = screenTop + 48 + row * 72;
        inner.push({
          ...createShape('square', innerX + 8, cardY),
          width: innerW - 16,
          height: 60,
        });
        inner.push({
          ...createShape('circle', innerX + 14, cardY + 8),
          width: 18,
          height: 18,
        });
        inner.push({
          ...createShape('square', innerX + 38, cardY + 12),
          width: innerW - 56,
          height: 6,
        });
        inner.push({
          ...createShape('square', innerX + 38, cardY + 24),
          width: innerW - 70,
          height: 6,
        });
      });
    } else {
      // Profile: avatar + name + bio + three settings rows.
      inner.push({
        ...createShape('circle', innerX + innerW / 2 - 26, screenTop + 30),
        width: 52,
        height: 52,
      });
      inner.push({
        ...createShape('square', innerX + 24, screenTop + 92),
        width: innerW - 48,
        height: 16,
        label: 'Alex Rivera',
        textSize: 'sm',
      });
      inner.push({
        ...createShape('square', innerX + 16, screenTop + 116),
        width: innerW - 32,
        height: 10,
      });
      ['Account', 'Notifications', 'Privacy'].forEach((row, i) => {
        inner.push({
          ...createShape('square', innerX + 8, screenTop + 146 + i * 38),
          width: innerW - 16,
          height: 32,
          label: row,
          textSize: 'sm',
          textAlignX: 'left',
        });
      });
    }

    // Bottom tab bar with three pill-shaped tabs.
    inner.push({
      ...createShape('square', innerX, tabBarY),
      width: innerW,
      height: tabBarH,
    });
    [0, 1, 2].forEach((i) => {
      inner.push({
        ...createShape('circle', innerX + 14 + i * (innerW / 3), tabBarY + 7),
        width: 14,
        height: 14,
      });
    });

    return { phone, inner };
  };

  (['Login', 'Feed', 'Profile'] as const).forEach((label, i) => {
    const x = startX + i * (phoneW + gap);
    const { phone, inner } = buildScreen(label, x);
    elements.push(phone, ...inner);
  });

  return elements;
}

// Laptop wireframe: a wide laptop frame with three internal
// placeholder rectangles sketched as a header + sidebar + content
// area. The laptop's silhouette comes from the device shape itself;
// the inner rectangles are plain squares so the user can rename
// each region without fighting the device's chrome geometry.
function buildLaptopWireframe(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const laptopW = 720;
  const laptopH = 440;
  const laptopX = cx - laptopW / 2;
  const laptopY = cy - laptopH / 2;
  elements.push({
    ...createShape('laptop', laptopX, laptopY),
    width: laptopW,
    height: laptopH,
  });
  // Screen area sits in the top ~46% of the laptop's bounding box
  // (the keyboard base lives below). Inset by 30px on each side so
  // the UI doesn't bleed into the bezel.
  const screenTop = laptopY + 20;
  const screenLeft = laptopX + 80;
  const screenW = laptopW - 160;
  const screenH = laptopH * 0.46 - 24;
  const headerH = 38;
  const sidebarW = 110;
  const innerGap = 8;
  const contentLeft = screenLeft + sidebarW + innerGap;
  const contentTop = screenTop + headerH + innerGap;
  const contentW = screenW - sidebarW - innerGap;
  const contentH = screenH - headerH - innerGap;

  // Header strip: logo (square) on the left, three nav pills in the
  // middle, an avatar (circle) on the right.
  elements.push({
    ...createShape('square', screenLeft, screenTop),
    width: screenW,
    height: headerH,
  });
  elements.push({
    ...createShape('square', screenLeft + 10, screenTop + 10),
    width: 60,
    height: 18,
    label: 'Logo',
    textSize: 'sm',
  });
  ['Home', 'Projects', 'Reports'].forEach((label, i) => {
    elements.push({
      ...createShape('stadium', screenLeft + 90 + i * 70, screenTop + 8),
      width: 60,
      height: 22,
      label,
      textSize: 'sm',
    });
  });
  elements.push({
    ...createShape('circle', screenLeft + screenW - 32, screenTop + 7),
    width: 24,
    height: 24,
  });

  // Sidebar: section title strip + a vertical stack of nav rows.
  elements.push({
    ...createShape('square', screenLeft, screenTop + headerH + innerGap),
    width: sidebarW,
    height: contentH,
  });
  const navItems = ['Overview', 'Customers', 'Pipeline', 'Reports', 'Settings'];
  navItems.forEach((label, i) => {
    elements.push({
      ...createShape('square', screenLeft + 8, screenTop + headerH + innerGap + 12 + i * 26),
      width: sidebarW - 16,
      height: 20,
      label,
      textSize: 'sm',
      textAlignX: 'left',
    });
  });

  // Main content area: page title, three stat cards in a row, and a
  // wider data card beneath.
  elements.push({
    ...createShape('square', contentLeft + 12, contentTop + 10),
    width: 220,
    height: 22,
    label: 'Dashboard',
    textSize: 'sm',
    textAlignX: 'left',
  });
  const cardGap = 10;
  const cardW = (contentW - 24 - cardGap * 2) / 3;
  const cardH = 70;
  ['Active users', 'Revenue', 'Conversion'].forEach((label, i) => {
    const cardX = contentLeft + 12 + i * (cardW + cardGap);
    const cardY = contentTop + 44;
    elements.push({
      ...createShape('square', cardX, cardY),
      width: cardW,
      height: cardH,
    });
    elements.push({
      ...createShape('square', cardX + 10, cardY + 10),
      width: cardW - 20,
      height: 12,
      label,
      textSize: 'sm',
      textAlignX: 'left',
    });
    elements.push({
      ...createShape('square', cardX + 10, cardY + 30),
      width: cardW - 20,
      height: 22,
      label: '0',
      textSize: 'md',
      textAlignX: 'left',
    });
  });
  // Wider data row card.
  const tableY = contentTop + 124;
  const tableH = contentTop + contentH - tableY - 12;
  if (tableH > 24) {
    elements.push({
      ...createShape('square', contentLeft + 12, tableY),
      width: contentW - 24,
      height: tableH,
      label: 'Recent activity',
      textSize: 'sm',
      textAlignY: 'top',
    });
  }
  return elements;
}

// Slide deck: four monitor frames in a 2 by 2 grid, each labelled
// like a PowerPoint slide ("Title", "Agenda", etc.). The monitor
// silhouette (rounded screen + stand) reads as a presentation slide
// at a glance and the natural aspect ratio matches typical slide
// proportions. Easy to extend (delete a slide, duplicate one).
function buildSlideDeck(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const slideW = 380;
  const slideH = 280;
  const gap = 90;
  const totalW = 2 * slideW + gap;
  const totalH = 2 * slideH + gap;
  const startX = cx - totalW / 2;
  const startY = cy - totalH / 2;

  // Each slide is a plain rectangle the user can resize / restyle.
  // Inside, a heading band sits at the top, then slide-specific
  // content (bullet rows, agenda items, a chart placeholder, an
  // action list). Arrows between the slides describe the deck's
  // reading order.
  type SlideKind = 'title' | 'agenda' | 'content' | 'actions';
  type Slide = {
    kind: SlideKind;
    heading: string;
    bullets: string[];
  };
  const slides: Slide[] = [
    {
      kind: 'title',
      heading: 'Q3 Roadmap',
      bullets: ['Team kick-off · 6 Aug', 'Hosted by Alex Rivera'],
    },
    {
      kind: 'agenda',
      heading: 'Agenda',
      bullets: ['Where we landed in Q2', 'Three Q3 bets', 'Risks + dependencies', 'Open questions'],
    },
    {
      kind: 'content',
      heading: 'Three Q3 bets',
      bullets: ['Self-serve onboarding', 'Realtime collaboration', 'Pricing experiment'],
    },
    {
      kind: 'actions',
      heading: 'Next steps',
      bullets: [
        'Lock scope by Friday',
        'Eng + design pairing',
        'Weekly review on Tuesdays',
        'Send recap by EOD',
      ],
    },
  ];

  const slideElements = slides.map((slide, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const slideX = startX + col * (slideW + gap);
    const slideY = startY + row * (slideH + gap);
    // The outer slide frame: a plain square (no device shape) so the
    // user can adjust the chrome to taste. textAlignY = top keeps any
    // future label they add anchored at the top of the slide.
    const frame = {
      ...createShape('square', slideX, slideY),
      width: slideW,
      height: slideH,
      textAlignY: 'top' as const,
    };
    elements.push(frame);

    // Heading band: a stadium-shaped accent strip at the top of each
    // slide so the slide title reads as a hero block. Sits inset by
    // 16px on each side so it doesn't crowd the slide edges.
    const headingH = 44;
    elements.push({
      ...createShape('stadium', slideX + 16, slideY + 16),
      width: slideW - 32,
      height: headingH,
      label: slide.heading,
      textSize: 'md',
    });

    if (slide.kind === 'title') {
      // Subtitle row + a tag pill at the bottom for the speaker.
      elements.push({
        ...createShape('square', slideX + 24, slideY + 16 + headingH + 18),
        width: slideW - 48,
        height: 30,
        label: slide.bullets[0]!,
        textSize: 'sm',
        textAlignX: 'left',
      });
      elements.push({
        ...createShape('stadium', slideX + 24, slideY + slideH - 50),
        width: 200,
        height: 28,
        label: slide.bullets[1]!,
        textSize: 'sm',
      });
    } else if (slide.kind === 'content') {
      // Three feature cards in a row beneath the heading.
      const cardGap = 12;
      const cardCount = slide.bullets.length;
      const cardW = (slideW - 32 - cardGap * (cardCount - 1)) / cardCount;
      const cardY = slideY + 16 + headingH + 22;
      const cardH = slideH - (16 + headingH + 22) - 32;
      slide.bullets.forEach((bullet, j) => {
        const bx = slideX + 16 + j * (cardW + cardGap);
        elements.push({
          ...createShape('square', bx, cardY),
          width: cardW,
          height: cardH,
        });
        elements.push({
          ...createShape('circle', bx + cardW / 2 - 16, cardY + 18),
          width: 32,
          height: 32,
        });
        elements.push({
          ...createShape('square', bx + 10, cardY + cardH - 60),
          width: cardW - 20,
          height: 38,
          label: bullet,
          textSize: 'sm',
        });
      });
    } else {
      // Agenda + actions both render as a stack of bullet rows.
      // Agenda uses square rows ("read more like a numbered list").
      // Actions uses stadiums ("read like to-do pills").
      const rowH = 28;
      const rowGap = 10;
      const rowsTop = slideY + 16 + headingH + 22;
      const rowsLeft = slideX + 28;
      const rowsW = slideW - 56;
      slide.bullets.forEach((bullet, j) => {
        const rowY = rowsTop + j * (rowH + rowGap);
        if (slide.kind === 'agenda') {
          // Small index square (1 / 2 / 3 / ...) followed by the row.
          elements.push({
            ...createShape('square', rowsLeft, rowY),
            width: 28,
            height: rowH,
            label: `${j + 1}`,
            textSize: 'sm',
          });
          elements.push({
            ...createShape('square', rowsLeft + 36, rowY),
            width: rowsW - 36,
            height: rowH,
            label: bullet,
            textSize: 'sm',
            textAlignX: 'left',
          });
        } else {
          // Actions: checkbox circle + a stadium row.
          elements.push({
            ...createShape('circle', rowsLeft, rowY + 4),
            width: rowH - 8,
            height: rowH - 8,
          });
          elements.push({
            ...createShape('stadium', rowsLeft + 32, rowY),
            width: rowsW - 32,
            height: rowH,
            label: bullet,
            textSize: 'sm',
            textAlignX: 'left',
          });
        }
      });
    }
    return frame;
  });

  // Connecting arrows: 1→2 (top row), 2→3 (right column, top to
  // bottom), 3→4 (bottom row). Anchored to each frame's nearest face
  // so the arrows visibly chain the slides in reading order.
  elements.push(createPinnedArrow(slideElements[0]!.id, 'e', slideElements[1]!.id, 'w'));
  elements.push(createPinnedArrow(slideElements[1]!.id, 's', slideElements[3]!.id, 'n'));
  elements.push(createPinnedArrow(slideElements[3]!.id, 'w', slideElements[2]!.id, 'e'));

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
  sectors.forEach((sector, i) => {
    const next = sectors[(i + 1) % sectors.length]!;
    const nextEl = sectorElements[(i + 1) % sectors.length]!;
    elements.push(createPinnedArrow(sectorElements[i]!.id, sector.out, nextEl.id, next.into));
  });

  return elements;
}
