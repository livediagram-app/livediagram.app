// Board templates lifted out of template-builders.ts: retrospective
// (Mad / Sad / Glad columns), kanban (four Todo-to-Done lanes), and
// SWOT (2x2 quadrants). All three share the same shape: a tinted
// container holds a header label + a stack of sticky-note rows. The
// grouping mirrors the picker's own "Boards / 2x2 layouts" rhythm.
//
// Venn deliberately stays in the parent file alongside Timeline:
// it's a 2D-overlap layout, not a column / lane grid, so it doesn't
// belong with this thematic group.
//
// Each builder is still pure: takes a centre (cx, cy), returns a
// fresh Element[]. See spec/09 "Templates" for the catalogue.

import {
  createArrow,
  createShape,
  createSticky,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

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
  const stickyH = 150;
  const stickyGap = 28;
  const topPadding = 24;
  const headerGap = 24;
  const bottomPadding = 24;
  const stickiesPerColumn = 3;
  const containerH =
    topPadding +
    headerH +
    headerGap +
    stickiesPerColumn * stickyH +
    (stickiesPerColumn - 1) * stickyGap +
    bottomPadding;

  // Each column seeds three believable starter cards so the board reads as a
  // real retro rather than three empty colour blocks. Authors overwrite them.
  const columns: { label: string; fill: string; stroke: string; notes: string[] }[] = [
    {
      label: 'Mad',
      fill: '#fee2e2',
      stroke: '#fca5a5',
      notes: [
        'Deploys still need a manual approval step',
        'Flaky tests blocked two PRs this sprint',
        'On-call paged three times for the same alert',
      ],
    },
    {
      label: 'Sad',
      fill: '#dbeafe',
      stroke: '#93c5fd',
      notes: [
        'Docs for the new API are out of date',
        'Standup ran long most mornings',
        'Design handoff slipped a few days',
      ],
    },
    {
      label: 'Glad',
      fill: '#dcfce7',
      stroke: '#86efac',
      notes: [
        'Onboarding flow shipped on time',
        'Pairing sessions cleared the review backlog',
        'New dashboard got great user feedback',
      ],
    },
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
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
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
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });

    for (let j = 0; j < stickiesPerColumn; j++) {
      const stickyY = headerY + headerH + headerGap + j * (stickyH + stickyGap);
      elements.push({
        ...createSticky(innerX, stickyY),
        width: colW,
        height: stickyH,
        label: col.notes[j] ?? '',
        textSize: 'sm',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    }
  });

  return elements;
}

// Four-column Kanban board (Todo List / In Progress / Under Review /
// Done) under a bold sprint title. Each lane is a tall container with a
// centred header and a stack of six cards; each card is a body square
// with the ticket description on top and a "priority" chip strip glued
// across its lower edge (a separate element so the priority can be
// edited / recoloured without retyping the ticket). Geometry mirrors a
// hand-built reference (505x835 lanes, 457x112 cards), re-centred on the
// supplied canvas point. Colours are left to the theme
// (recolourElementsForTheme); cards read via their borders + the chip.
// The board ships pre-layered (spec/74 "Layered templates"): the title,
// lane containers and headers sit on a "Board" scaffold layer under a
// "Cards" content layer holding the tickets, so cards drag between
// lanes without grabbing the lane behind them. templateCanvasOverrides
// carries the matching Tab.layers for these ids.
export function buildKanban(cx: number, cy: number): Element[] {
  const colW = 505;
  const colH = 600;
  const colGap = 23;
  const colPitch = colW + colGap;
  // A realistic mid-sprint board: lanes hold different numbers of varied,
  // believable tickets (not 24 identical cards) with mixed priorities.
  const lanes: {
    header: string;
    cards: { id: string; summary: string; priority: string }[];
  }[] = [
    {
      header: 'Todo List',
      cards: [
        { id: 'LIVE-241', summary: 'Add CSV export to the reports page', priority: 'Medium' },
        { id: 'LIVE-238', summary: 'Fix timezone bug in the calendar view', priority: 'High' },
        { id: 'LIVE-245', summary: 'Empty-state illustrations for Explorer', priority: 'Low' },
        { id: 'LIVE-250', summary: 'Rate-limit the share-link endpoint', priority: 'High' },
      ],
    },
    {
      header: 'In Progress',
      cards: [
        { id: 'LIVE-233', summary: 'Realtime cursors flicker on reconnect', priority: 'High' },
        { id: 'LIVE-236', summary: 'Refactor the theme picker', priority: 'Medium' },
        { id: 'LIVE-240', summary: 'Draft the onboarding email sequence', priority: 'Low' },
      ],
    },
    {
      header: 'Under Review',
      cards: [
        { id: 'LIVE-229', summary: 'Keyboard shortcuts for the canvas', priority: 'Medium' },
        { id: 'LIVE-231', summary: 'Migrate image uploads to R2', priority: 'High' },
      ],
    },
    {
      header: 'Done',
      cards: [
        { id: 'LIVE-220', summary: 'Dark mode for the settings page', priority: 'Medium' },
        { id: 'LIVE-214', summary: 'Speed up the dashboard query', priority: 'High' },
        { id: 'LIVE-218', summary: 'Build the avatar component', priority: 'Low' },
      ],
    },
  ];
  const boardW = lanes.length * colW + (lanes.length - 1) * colGap;

  const titleH = 64;
  const titleGap = 46;
  const totalH = titleH + titleGap + colH;
  const startX = cx - boardW / 2;
  const startY = cy - totalH / 2;
  const columnsTop = startY + titleH + titleGap;

  const firstCardTop = 71; // relative to the column top
  const cardPitch = 125;
  const cardBodyH = 112;

  const elements: Element[] = [];

  // Board title across the full width of the lanes.
  elements.push({
    ...createText(startX, startY),
    width: boardW,
    height: titleH,
    label: 'Sprint 12 · September 2027',
    textSize: 'lg',
    textBold: true,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  lanes.forEach((lane, ci) => {
    const colX = startX + ci * colPitch;
    // Lane container.
    elements.push({
      ...createShape('square', colX, columnsTop),
      width: colW,
      height: colH,
      textSize: 'md',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    // Lane header.
    elements.push({
      ...createText(colX, columnsTop + 5),
      width: colW,
      height: 64,
      label: lane.header,
      textSize: 'lg',
      textAlignX: 'center',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    // Cards: body + ticket text (bold id lead-in + summary) + priority chip.
    lane.cards.forEach((card, i) => {
      const cardTop = columnsTop + firstCardTop + i * cardPitch;
      elements.push({
        ...createShape('square', colX + 24, cardTop),
        width: 457,
        height: cardBodyH,
        textSize: 'md',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
      const runs: TextRun[] = [{ text: `${card.id}:`, bold: true }, { text: ` ${card.summary}` }];
      elements.push({
        ...createText(colX + 32, cardTop + 6),
        width: 441,
        height: 64,
        label: runsPlainText(runs),
        richText: runs,
        textSize: 'sm',
        textAlignX: 'left',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
      elements.push({
        ...createShape('square', colX + 30, cardTop + 76),
        width: 445,
        height: 28,
        label: `${card.priority} priority`,
        textSize: 'sm',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    });
  });

  return elements;
}

// SWOT 2×2 grid sized to give each quadrant real working room. Each
// quadrant carries a role icon in its top-right (award / trending-down
// / sun / alert-octagon) and 3 starter bullets the user can swap for
// their own. Quadrant tints follow the conventional emotional weighting
// — Strengths green / Opportunities blue (positives), Weaknesses red /
// Threats amber (concerns). Each bullet is its own Text element so
// users can move/delete individual lines without breaking the scaffold.
export function buildSwot(cx: number, cy: number): Element[] {
  const cellW = 560;
  const cellH = 440;
  const gap = 28;
  const headerH = 64;
  const headerPadding = 20;
  const bulletGap = 14;
  const bulletH = 56;
  const iconSize = 58;

  const quadrants: {
    label: string;
    col: 0 | 1;
    row: 0 | 1;
    fill: string;
    stroke: string;
    headerColor: string;
    // A glyph in the quadrant's top-right that signals its role at a
    // glance (award = strengths, trending-down = weaknesses, etc.).
    icon: string;
    bullets: string[];
  }[] = [
    {
      label: 'Strengths',
      col: 0,
      row: 0,
      fill: '#dcfce7',
      stroke: '#86efac',
      headerColor: '#15803d',
      icon: 'award',
      bullets: ['Strong brand recognition', 'Loyal customer base', 'Proven, profitable product'],
    },
    {
      label: 'Weaknesses',
      col: 1,
      row: 0,
      fill: '#fee2e2',
      stroke: '#fca5a5',
      headerColor: '#b91c1c',
      icon: 'trending-down',
      bullets: ['Limited geographic reach', 'High operational costs', 'Slow product delivery'],
    },
    {
      label: 'Opportunities',
      col: 0,
      row: 1,
      fill: '#dbeafe',
      stroke: '#93c5fd',
      headerColor: '#1d4ed8',
      icon: 'sun',
      bullets: ['Expand to new markets', 'Strategic partnerships', 'Emerging tech trends'],
    },
    {
      label: 'Threats',
      col: 1,
      row: 1,
      fill: '#fef3c7',
      stroke: '#fcd34d',
      headerColor: '#a16207',
      icon: 'alert-octagon',
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
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
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
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });

    // Role glyph in the top-right corner, tinted to match the header.
    elements.push({
      ...createShape('icon', x + cellW - headerPadding - iconSize, y + headerPadding),
      width: iconSize,
      height: iconSize,
      iconId: q.icon,
      strokeColor: q.headerColor,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });

    // Starter bullets sit under the header. Width matches the header
    // so the text rail aligns crisply down the quadrant's left edge. The
    // bullet marker is tinted to the quadrant's header hue (per-range
    // rich text, spec/09) so each line ties back to its quadrant while
    // the body text stays theme-neutral.
    q.bullets.forEach((bullet, i) => {
      const runs: TextRun[] = [{ text: '• ', color: q.headerColor }, { text: bullet }];
      elements.push({
        ...createText(
          x + headerPadding,
          y + headerPadding + headerH + bulletGap + i * (bulletH + bulletGap),
        ),
        width: cellW - headerPadding * 2,
        height: bulletH,
        label: runsPlainText(runs),
        richText: runs,
        textSize: 'md',
        textAlignX: 'left',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    });
  }

  // Centre pill naming the subject under analysis. It sits in the cross-gap
  // where the four quadrants meet (their inner corners are empty, since the
  // bullets hug each quadrant's top-left), tying every quadrant back to one
  // thing. Pushed last so it layers above the quadrant fills.
  const subjectW = 248;
  const subjectH = 58;
  elements.push({
    ...createShape('stadium', cx - subjectW / 2, cy - subjectH / 2),
    width: subjectW,
    height: subjectH,
    label: 'Our business',
    textSize: 'md',
    textBold: true,
    textAlignX: 'center',
    // The subject under analysis ties all four quadrants together → hero preset.
    colorPreset: 'bold',
    // Content layer (spec/74): the rename target rides with the notes, so
    // it stays clickable when the quadrant scaffold is locked.
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  return elements;
}

// Impact / Effort prioritisation chart. Two crossed value/effort axes
// (a centred double-headed quadrant divider plus an L-frame of single-
// headed axes along the left + bottom) with a handful of items
// scattered across the field for the user to drag into the right
// quadrant. Geometry mirrors a hand-built reference (its bounding box
// spans 0..1542 x 0..1218), re-centred on the supplied canvas point.
// The axes carry the brand accent; items + labels are left to the theme.
export function buildPrioritizationMatrix(cx: number, cy: number): Element[] {
  const ox = cx - 771;
  const oy = cy - 609;
  const AXIS = '#0ea5e9'; // brand accent

  const elements: Element[] = [];

  // Axes: a centred double-headed divider (the quadrant cross) and an
  // L-frame whose single arrowheads point toward "more" on each axis.
  const axis = (x1: number, y1: number, x2: number, y2: number, ends: 'both' | 'to'): Element => ({
    ...createArrow(x1 + ox, y1 + oy, x2 + ox, y2 + oy),
    arrowEnds: ends,
    strokeColor: AXIS,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });
  elements.push(axis(394, 627, 1568, 627, 'both'));
  elements.push(axis(981, 1131, 981, 158, 'both'));
  elements.push(axis(373, 1152, 1547, 1152, 'to'));
  elements.push(axis(373, 1152, 373, 179, 'to'));

  // Axis labels at the ends of the value (vertical) + effort (horizontal) axes.
  const label = (x: number, y: number, text: string): Element => ({
    ...createText(x + ox, y + oy),
    width: 190,
    height: 42,
    label: text,
    textSize: 'lg',
    textBold: true,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });
  elements.push(label(158, 183, 'High Value'));
  elements.push(label(158, 1107, 'Low Value'));
  elements.push(label(372, 1176, 'Low Effort'));
  elements.push(label(1352, 1176, 'High Effort'));

  // Items scattered across the field — the user drags each into the
  // quadrant that matches its value / effort.
  // Realistic backlog items placed to match their quadrant (top = high value,
  // left = low effort): a quick win, a big bet, and a couple to reconsider.
  // The top-right item is nudged in from 1408 so it can't clip the field edge.
  const items: { x: number; y: number; label: string }[] = [
    { x: 1340, y: 183, label: 'Realtime collab' },
    { x: 824, y: 679, label: 'Revamp onboarding' },
    { x: 1325, y: 770, label: 'Settings redesign' },
    { x: 1147, y: 932, label: 'Custom fonts' },
    { x: 621, y: 183, label: 'Keyboard shortcuts' },
  ];
  for (const it of items) {
    elements.push({
      ...createShape('square', it.x + ox, it.y + oy),
      width: 122,
      height: 49,
      label: it.label,
      textSize: 'sm',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  }

  return elements;
}
