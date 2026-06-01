// Board templates lifted out of template-builders.ts: retrospective
// (Mad / Sad / Glad columns), kanban (five Backlog-to-Done lanes),
// and SWOT (2x2 quadrants). All three share the same shape: a tinted
// container holds a header label + a stack of sticky-note rows. The
// grouping mirrors the picker's own "Boards / 2x2 layouts" rhythm.
//
// Venn deliberately stays in the parent file alongside Timeline:
// it's a 2D-overlap layout, not a column / lane grid, so it doesn't
// belong with this thematic group.
//
// Each builder is still pure: takes a centre (cx, cy), returns a
// fresh Element[]. See spec/09 "Templates" for the catalogue.

import { createShape, createSticky, createText, type Element } from '@livediagram/diagram';

// Classic "Mad / Sad / Glad" retro. Each column lives inside its own
// tinted container shape (red / blue / green) so the framework's
// emotional groupings read at a glance. Header text + three sticky
// notes sit on top of the container; the container is the first
// element pushed per column so subsequent label + sticky elements
// render above it.
export function buildRetrospective(cx: number, cy: number): Element[] {
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
export function buildKanban(cx: number, cy: number): Element[] {
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
export function buildSwot(cx: number, cy: number): Element[] {
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
