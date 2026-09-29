// Per-template element builders for the three timeline templates: the
// horizontal timeline, and the milestone timeline in both orientations. Split
// out of template-builders-diagrams, which had become the catch-all bucket
// while its sixteen siblings (gantt, roadmap, uml, wireframes, ...) are each
// one family. The timelines were half its 659 lines and are a family of their
// own: three takes on "events along a track".
//
// Each builder is pure: (cx, cy) -> Element[]. build-template dispatches here.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
} from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// The quick timeline: a year of product milestones on one forward-pointing
// line. Each dot's colour says where the milestone stands (done / in
// progress / up next, keyed by a small legend), a dashed "Today" marker
// splits what has happened from what is coming, and labels alternate above
// and below so six milestones never crowd. Lighter than the milestone
// timelines (no cards, no stems): the one to reach for when you need a
// status-at-a-glance line, not a presentation.
export function buildTimeline(cx: number, cy: number): Element[] {
  type Status = 'done' | 'current' | 'next';
  const STATUS: Record<Status, { fill: string; stroke: string; legend: string }> = {
    done: { fill: '#22c55e', stroke: '#15803d', legend: 'Done' },
    current: { fill: '#3b82f6', stroke: '#1d4ed8', legend: 'In progress' },
    next: { fill: '#ffffff', stroke: '#94a3b8', legend: 'Up next' },
  };
  const milestones: { title: string; date: string; status: Status }[] = [
    { title: 'Kick-off', date: 'January', status: 'done' },
    { title: 'Prototype tested', date: 'March', status: 'done' },
    { title: 'Private beta', date: 'May', status: 'done' },
    { title: 'Public launch', date: 'July', status: 'current' },
    { title: 'Mobile app', date: 'September', status: 'next' },
    { title: 'Year-two plan', date: 'November', status: 'next' },
  ];
  const lineLength = 1320;
  const dot = 36;
  const labelW = 200;
  const titleH = 34;
  const dateH = 26;
  const verticalOffset = 44;
  const startX = cx - lineLength / 2;
  const x = (i: number) => startX + ((i + 0.5) / milestones.length) * lineLength;

  const elements: Element[] = [];
  // Spine: forward in time, so it carries an arrowhead at the future end.
  // It is the scaffold layer (docs/specs/006-diagram/layers.md); markers + labels ride the
  // content layer above it.
  elements.push({
    ...createArrow(startX, cy, startX + lineLength, cy),
    strokeColor: '#64748b',
    strokeWidth: 3,
    routeBehind: false,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  milestones.forEach(({ title, date, status }, i) => {
    const style = STATUS[status];
    // The in-progress milestone is the one to look at, so it is larger.
    const size = status === 'current' ? dot + 12 : dot;
    elements.push({
      ...createShape('circle', x(i) - size / 2, cy - size / 2),
      width: size,
      height: size,
      label: '',
      fillColor: style.fill,
      strokeColor: style.stroke,
      strokeWidth: 'medium',
      // Status colour is meaning, so it survives a theme switch.
      themeLockFill: true,
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    const above = i % 2 === 0;
    // Title nearest the line, date beyond it, mirrored below the line.
    const titleY = above ? cy - verticalOffset - titleH : cy + verticalOffset;
    const dateY = above ? titleY - dateH : titleY + titleH;
    elements.push({
      ...createText(x(i) - labelW / 2, titleY),
      width: labelW,
      height: titleH,
      label: title,
      textSize: 'md',
      textBold: status === 'current',
      textAlignX: 'center',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    elements.push({
      ...createText(x(i) - labelW / 2, dateY),
      width: labelW,
      height: dateH,
      label: date,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });

  // Today: a dashed marker midway between the in-progress milestone and the
  // next one (clear of both labels), tagged with a pill at its top. Drag it
  // along as the year moves.
  const todayX = (x(3) + x(4)) / 2;
  const markerTop = cy - verticalOffset - titleH - dateH - 18;
  const markerBottom = cy + verticalOffset + titleH + dateH + 6;
  elements.push({
    ...createArrow(todayX, markerTop + 36, todayX, markerBottom),
    arrowEnds: 'none',
    strokeStyle: 'dashed',
    strokeColor: '#e11d48',
    strokeWidth: 2,
    routeBehind: false,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  elements.push({
    ...createShape('stadium', todayX - 44, markerTop),
    width: 88,
    height: 36,
    label: 'Today',
    textSize: 'sm',
    textBold: true,
    fillColor: '#e11d48',
    strokeColor: '#e11d48',
    textColor: '#ffffff',
    themeLockFill: true,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  // Legend, bottom right under the line's end.
  const legendY = markerBottom + 34;
  let lx = startX + lineLength - 3 * 150;
  for (const status of ['done', 'current', 'next'] as const) {
    const style = STATUS[status];
    elements.push({
      ...createShape('circle', lx, legendY + 5),
      width: 18,
      height: 18,
      label: '',
      fillColor: style.fill,
      strokeColor: style.stroke,
      themeLockFill: true,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createText(lx + 26, legendY),
      width: 110,
      height: 28,
      label: style.legend,
      textSize: 'sm',
      textAlignX: 'left',
      textColor: '#64748b',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    lx += 150;
  }
  return elements;
}

// Milestone timeline — the richer, presentation-ready sibling of the plain
// 'timeline' above, designed from scratch rather than derived from it. A
// directional spine (arrowhead pointing forward in time) carries five
// milestone dots; each milestone hangs a card off a stem, alternating above
// and below, with a date chip riding the stem near the spine and a muted
// one-line description beyond the card. The stems are PINNED arrows
// (dot → card) so dragging a card keeps its stem attached, and the chips
// paint over the stems so they read as beads on the line. Launch is the
// hero milestone (bold preset); Kick-off gets a soft tint as the entry
// point. A bold plan title anchors the top-left like the kanban / RACI
// boards.
export function buildMilestoneTimeline(cx: number, cy: number): Element[] {
  const spineLength = 1240;
  const dotSize = 20;
  const chipW = 104;
  const chipH = 32;
  const chipOffset = 56; // spine → chip centre
  const cardW = 208;
  const cardH = 64;
  const cardOffset = 148; // spine → card centre
  const descW = 232;
  const descH = 34;
  const descGap = 8; // card edge → description

  const startX = cx - spineLength / 2;
  const baseY = cy;
  const elements: Element[] = [];

  // Plan title, top-left above the first (above-side) milestone block.
  elements.push({
    ...createText(startX, baseY - cardOffset - cardH / 2 - descGap - descH - 74),
    width: 520,
    height: 48,
    label: 'Launch plan · 2027',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'left',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  // The spine keeps its arrowhead: time flows left to right.
  elements.push({
    ...createArrow(startX, baseY, startX + spineLength, baseY),
    strokeColor: '#64748b',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  const milestones: { title: string; date: string; note: string; preset?: string }[] = [
    { title: 'Kick-off', date: 'January', note: 'Scope agreed, team assembled', preset: 'soft' },
    { title: 'Design freeze', date: 'March', note: 'Specs and designs signed off' },
    { title: 'Beta release', date: 'May', note: 'First customers onboarded' },
    { title: 'Launch', date: 'July', note: 'Generally available', preset: 'bold' },
    { title: 'Retrospective', date: 'September', note: 'Adoption reviewed, next bets picked' },
  ];

  const dots: Element[] = [];
  const stems: Element[] = [];
  const chips: Element[] = [];
  const cards: Element[] = [];
  const notes: Element[] = [];
  milestones.forEach(({ title, date, note, preset }, i) => {
    const x = startX + ((i + 0.5) / milestones.length) * spineLength;
    const above = i % 2 === 0;
    const dir = above ? -1 : 1;
    const dot = {
      ...createShape('circle', x - dotSize / 2, baseY - dotSize / 2),
      width: dotSize,
      height: dotSize,
      colorPreset: 'solid',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    };
    const card = {
      ...createShape('square', x - cardW / 2, baseY + dir * cardOffset - cardH / 2),
      width: cardW,
      height: cardH,
      label: title,
      textSize: 'md' as const,
      borderRadius: 'lg' as const,
      ...(preset ? { colorPreset: preset } : {}),
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    };
    dots.push(dot);
    cards.push(card);
    // Stem: pinned dot → card so it follows a dragged card. Painted under
    // the chip (arrows go first in the returned array).
    stems.push({
      ...createPinnedArrow(dot.id, above ? 'n' : 's', card.id, above ? 's' : 'n'),
      arrowEnds: 'none' as const,
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    chips.push({
      ...createShape('stadium', x - chipW / 2, baseY + dir * chipOffset - chipH / 2),
      width: chipW,
      height: chipH,
      label: date,
      textSize: 'sm',
      colorPreset: 'soft',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    // One-line description on the far side of the card, away from the spine.
    const descY = above
      ? baseY - cardOffset - cardH / 2 - descGap - descH
      : baseY + cardOffset + cardH / 2 + descGap;
    notes.push({
      ...createText(x - descW / 2, descY),
      width: descW,
      height: descH,
      label: note,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });
  return [...elements, ...stems, ...dots, ...chips, ...cards, ...notes];
}

// Vertical milestone timeline — the same stemmed-card composition as
// buildMilestoneTimeline, run down the page: a downward spine (arrowhead at
// the bottom, time flows down) with cards branching left and right, date
// chips riding the pinned stems, and a one-line description under each
// card. Shares the horizontal variant's content and preset grammar so the
// pair read as siblings in the picker.
export function buildMilestoneTimelineVertical(cx: number, cy: number): Element[] {
  const spineLength = 920;
  const dotSize = 20;
  const chipW = 104;
  const chipH = 32;
  const chipOffset = 72; // spine → chip centre
  const cardW = 208;
  const cardH = 64;
  const cardOffset = 260; // spine → card centre
  const descW = 232;
  const descH = 34;
  const descGap = 6; // card edge → description

  const startY = cy - spineLength / 2;
  const spineX = cx;
  const elements: Element[] = [];

  // Plan title above the spine's head, centred on it.
  elements.push({
    ...createText(spineX - 260, startY - 78),
    width: 520,
    height: 48,
    label: 'Launch plan · 2027',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  // The spine keeps its arrowhead: time flows top to bottom.
  elements.push({
    ...createArrow(spineX, startY, spineX, startY + spineLength),
    strokeColor: '#64748b',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  const milestones: { title: string; date: string; note: string; preset?: string }[] = [
    { title: 'Kick-off', date: 'January', note: 'Scope agreed, team assembled', preset: 'soft' },
    { title: 'Design freeze', date: 'March', note: 'Specs and designs signed off' },
    { title: 'Beta release', date: 'May', note: 'First customers onboarded' },
    { title: 'Launch', date: 'July', note: 'Generally available', preset: 'bold' },
    { title: 'Retrospective', date: 'September', note: 'Adoption reviewed, next bets picked' },
  ];

  const dots: Element[] = [];
  const stems: Element[] = [];
  const chips: Element[] = [];
  const cards: Element[] = [];
  const notes: Element[] = [];
  milestones.forEach(({ title, date, note, preset }, i) => {
    const y = startY + ((i + 0.5) / milestones.length) * spineLength;
    // Alternate left / right of the spine.
    const dir = i % 2 === 0 ? -1 : 1;
    const dot = {
      ...createShape('circle', spineX - dotSize / 2, y - dotSize / 2),
      width: dotSize,
      height: dotSize,
      colorPreset: 'solid',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    };
    const card = {
      ...createShape('square', spineX + dir * cardOffset - cardW / 2, y - cardH / 2),
      width: cardW,
      height: cardH,
      label: title,
      textSize: 'md' as const,
      borderRadius: 'lg' as const,
      ...(preset ? { colorPreset: preset } : {}),
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    };
    dots.push(dot);
    cards.push(card);
    // Stem: pinned dot → card so it follows a dragged card; the date chip
    // paints over it (arrows go first in the returned array).
    stems.push({
      ...createPinnedArrow(dot.id, dir < 0 ? 'w' : 'e', card.id, dir < 0 ? 'e' : 'w'),
      arrowEnds: 'none' as const,
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    chips.push({
      ...createShape('stadium', spineX + dir * chipOffset - chipW / 2, y - chipH / 2),
      width: chipW,
      height: chipH,
      label: date,
      textSize: 'sm',
      colorPreset: 'soft',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    // One-line description tucked under its card.
    notes.push({
      ...createText(spineX + dir * cardOffset - descW / 2, y + cardH / 2 + descGap),
      width: descW,
      height: descH,
      label: note,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });
  return [...elements, ...stems, ...dots, ...chips, ...cards, ...notes];
}
