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

// Horizontal timeline with 5 milestone markers — circles on the line,
// alternating labels above and below so they don't crowd. Each label
// is a stacked pair: a milestone title on top and a date subtext
// beneath (e.g. "Phase 1" / "March") so the chart reads as an actual
// dated schedule, not just a sequence of named beats. Two Text
// primitives per milestone keeps the date independently styleable
// (smaller size, muted colour) without a custom element kind.
export function buildTimeline(cx: number, cy: number): Element[] {
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
    // The spine is the timeline's scaffold layer (spec/74); the
    // milestone markers + labels ride the content layer above it.
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
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
      layerId: TEMPLATE_CONTENT_LAYER_ID,
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
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    elements.push({
      ...createText(x - labelW / 2, blockTop + titleH + labelGap),
      width: labelW,
      height: dateH,
      label: date,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });
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
