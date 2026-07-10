// Wording for activity-log entries (spec/12): turns the added /
// removed / edited element sets a commit produced into the one-line
// summary the Activity panel shows. Split out of lib/change-log.ts so
// the diff / revert mechanics and the vocabulary live in separately
// focused modules.
//
// The goal is a sharp verb, not a diff dump: "Moved 'API'", not
// "Edited 'API'". Each phrase below inspects WHICH fields changed and
// names the action a user would recognise ("Rotated", "Recoloured",
// "Reshaped an Arrow"). Anything that doesn't match a known field
// group falls back to the honest-but-vague "Edited X".

import type { ArrowElement, BoxedElement, Element } from '@livediagram/diagram';
import { article, describeMany, describeOne, kindLabel } from './element-names';
import type { ChangeLogKind } from './api-client';

export type EditedPair = { before: Element; after: Element };

// Set of keys that differ between two snapshots of the same element.
// JSON.stringify per key is the cheapest "deep equal" for the data
// shapes we have here (no functions, no cyclical references).
export function diffKeys(before: Element, after: Element): Set<string> {
  const allKeys = new Set([
    ...Object.keys(before as Record<string, unknown>),
    ...Object.keys(after as Record<string, unknown>),
  ]);
  const keys = new Set<string>();
  for (const k of allKeys) {
    const a = (before as Record<string, unknown>)[k];
    const b = (after as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) keys.add(k);
  }
  return keys;
}

// --- Field groups -----------------------------------------------------------
// Each group is "the set of keys this user-visible action can touch".
// A change classifies as the action when every changed key falls
// inside the group (so a mixed change never gets a misleading verb).

const POSITION_KEYS = ['x', 'y'];
const SIZE_KEYS = ['x', 'y', 'width', 'height'];
// `bg` is the sticky-note tint; `colorPreset` tags a palette swatch
// pick and always rides along with the colours it sets.
const COLOUR_KEYS = ['fillColor', 'strokeColor', 'textColor', 'bg', 'colorPreset'];
const TEXT_STYLE_KEYS = [
  'textSize',
  'textBold',
  'textItalic',
  'textUnderline',
  'textStrikethrough',
  'textAlignX',
  'textAlignY',
  'textColor',
  'font',
  'bold',
  'italic',
  'richText',
  'padding',
];
const BORDER_KEYS = ['strokeWidth', 'strokeStyle', 'borderRadius'];
const ARROW_STYLE_KEYS = [
  'strokeWidth',
  'strokeStyle',
  'arrowheadSize',
  'arrowheadShape',
  'arrowEnds',
  'arrowStyle',
];
const ARROW_SHAPE_KEYS = ['from', 'to', 'curveOffset', 'curvePoints', 'elbowOffset'];
const ANIMATION_KEYS = [
  'animation',
  'animationSpeed',
  'iconAnimation',
  'iconAnimationSpeed',
  'flow',
  'flowSpeed',
  'progressAnim',
  'progressAnimRepeat',
  'progressAnimSpeed',
  'ratingAnim',
  'ratingAnimRepeat',
  'ratingAnimSpeed',
  'pieAnim',
  'pieAnimRepeat',
  'pieAnimSpeed',
];
const ICON_KEYS = ['iconId', 'iconPosition', 'iconSize'];
const CHART_KEYS = [
  'pieSlices',
  'lineCategories',
  'lineSeries',
  'chartLegend',
  'chartLegendPosition',
];
const TABLE_CELL_KEYS = ['cells', 'cellStyles'];
const TABLE_STYLE_KEYS = ['headerRow', 'headerColumn', 'headerFill', 'headerTextColor'];
// A sketch edit (partial erase, closing the path) rewrites the points
// and usually re-fits the bounding box with them.
const SKETCH_KEYS = ['points', 'closed', 'x', 'y', 'width', 'height'];

const allIn = (keys: Set<string>, allowed: readonly string[]) =>
  [...keys].every((k) => allowed.includes(k));

// The value every `after` element agrees on, or undefined when they
// disagree — value-bearing phrases ("to 40%") only read when uniform.
function uniformAfter<T>(pairs: EditedPair[], pick: (el: Element) => T): T | undefined {
  const first = pick(pairs[0]!.after);
  return pairs.every((p) => JSON.stringify(pick(p.after)) === JSON.stringify(first))
    ? first
    : undefined;
}

const articled = (el: Element) => {
  const k = kindLabel(el);
  return `${article(k)} ${k}`;
};

// --- Single-element phrases with values -------------------------------------

// Label-only change: "Labelled a Square 'Login'", "Renamed 'Login' to
// 'Sign in'", "Cleared the label on a Square".
function labelPhrase(before: Element, after: Element): string {
  const oldLabel = ((before as BoxedElement).label ?? '').trim();
  const newLabel = ((after as BoxedElement).label ?? '').trim();
  if (!newLabel) return `Cleared the label on ${articled(after)}`;
  if (!oldLabel) return `Labelled ${articled(after)} '${newLabel}'`;
  return `Renamed '${oldLabel}' to '${newLabel}'`;
}

// A pure whole-arrow translation moves both free endpoints by the same
// delta — that's a drag of the line, so "Moved", not "Reshaped".
function isArrowTranslation(before: ArrowElement, after: ArrowElement): boolean {
  if (before.from.kind !== 'free' || before.to.kind !== 'free') return false;
  if (after.from.kind !== 'free' || after.to.kind !== 'free') return false;
  const dx1 = after.from.x - before.from.x;
  const dy1 = after.from.y - before.from.y;
  const dx2 = after.to.x - before.to.x;
  const dy2 = after.to.y - before.to.y;
  return dx1 === dx2 && dy1 === dy2;
}

// Looser check for an arrow inside a MIXED selection drag: each
// changed endpoint either stayed on its tracked target (a pinned /
// on-arrow / group endpoint re-anchoring as the boxes moved) or is a
// free point that translated; two changed free ends must share the
// delta. Used only when boxes moved in the same commit, so the
// endpoint-reshape ambiguity of a lone free end doesn't apply.
function arrowMovedWithSelection(before: ArrowElement, after: ArrowElement): boolean {
  const deltas: { dx: number; dy: number }[] = [];
  for (const end of ['from', 'to'] as const) {
    const b = before[end];
    const a = after[end];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (b.kind === 'free' && a.kind === 'free') {
      deltas.push({ dx: a.x - b.x, dy: a.y - b.y });
      continue;
    }
    // Same non-free kind on both sides: the endpoint is tracking a
    // target that moved with the selection.
    if (b.kind === a.kind && b.kind !== 'free') continue;
    return false;
  }
  return deltas.length < 2 || (deltas[0]!.dx === deltas[1]!.dx && deltas[0]!.dy === deltas[1]!.dy);
}

// --- The edit classifier -----------------------------------------------------

// Sharp phrase for a commit that only EDITED elements (no adds or
// removes). Handles one element or many: the changed-key union across
// every pair picks the verb, `subject` names the target(s).
export function summarizeEdits(pairs: EditedPair[]): string {
  const afters = pairs.map((p) => p.after);
  const subject = pairs.length === 1 ? describeOne(afters[0]!) : describeMany(afters);
  const keys = new Set<string>();
  for (const p of pairs) for (const k of diffKeys(p.before, p.after)) keys.add(k);
  if (keys.size === 0) return `Edited ${subject}`;

  // Value-bearing single-element phrases first — they can say more
  // than a group verb ("Renamed 'Login' to 'Sign in'").
  if (pairs.length === 1) {
    const { before, after } = pairs[0]!;
    if (keys.size === 1 && keys.has('label')) return labelPhrase(before, after);
    // Shape-kind swap via the context menu ("Change shape"): the box
    // may re-fit, so allow the geometry keys to ride along.
    if (keys.has('shape') && allIn(keys, ['shape', ...SIZE_KEYS])) {
      return `Changed ${describeOne(before)} to ${articled(after)}`;
    }
  }

  const allArrows = afters.every((el) => el.type === 'arrow');
  if (allArrows && allIn(keys, [...ARROW_SHAPE_KEYS, ...POSITION_KEYS])) {
    const translated = pairs.every((p) =>
      isArrowTranslation(p.before as ArrowElement, p.after as ArrowElement),
    );
    return `${translated ? 'Moved' : 'Reshaped'} ${subject}`;
  }
  // Position-only for boxes; arrows in the same drag surface as
  // endpoint changes, so allow those when they track the move.
  if (allIn(keys, [...POSITION_KEYS, 'from', 'to'])) {
    const arrowsFollowed = pairs.every(
      (p) =>
        p.after.type !== 'arrow' ||
        arrowMovedWithSelection(p.before as ArrowElement, p.after as ArrowElement),
    );
    if (arrowsFollowed) return `Moved ${subject}`;
  }
  if (allIn(keys, SIZE_KEYS) && (keys.has('width') || keys.has('height'))) {
    return `Resized ${subject}`;
  }
  if (allIn(keys, ['rotation'])) return `Rotated ${subject}`;
  // A colour-preset apply (spec/48) stamps colours + border + the
  // preset id in one move. Name the preset when the id is a plain
  // token ('bold' → Bold — the picker shows the same word); the
  // multi-colour themes' 'branch-<i>' ids aren't names, so those get
  // the generic phrase. A CLEARED id (hand-editing a colour breaks
  // the binding) falls through to the plain colour verdict below.
  if (keys.has('colorPreset') && allIn(keys, [...COLOUR_KEYS, ...BORDER_KEYS])) {
    const presetId = uniformAfter(pairs, (el) =>
      'colorPreset' in el ? (el as { colorPreset?: string }).colorPreset : undefined,
    );
    if (presetId) {
      return /^[a-z]+$/.test(presetId)
        ? `Applied the ${presetId.charAt(0).toUpperCase() + presetId.slice(1)} style to ${subject}`
        : `Applied a colour preset to ${subject}`;
    }
  }
  if (allIn(keys, COLOUR_KEYS)) return `Recoloured ${subject}`;
  if (allIn(keys, ['opacity'])) {
    const opacity = uniformAfter(pairs, (el) => ('opacity' in el ? el.opacity : undefined));
    return opacity === undefined
      ? `Changed the opacity of ${subject}`
      : `Set the opacity of ${subject} to ${Math.round((opacity ?? 1) * 100)}%`;
  }
  if (allIn(keys, ['locked'])) {
    const locked = uniformAfter(pairs, (el) => el.locked === true);
    if (locked !== undefined) return `${locked ? 'Locked' : 'Unlocked'} ${subject}`;
  }
  if (allIn(keys, ['link'])) {
    const hadLink = pairs.every((p) => 'link' in p.before && p.before.link);
    const hasLink = pairs.every((p) => 'link' in p.after && p.after.link);
    if (!hadLink && hasLink) return `Added a link to ${subject}`;
    if (hadLink && !hasLink) return `Removed the link from ${subject}`;
    return `Changed the link on ${subject}`;
  }
  if (allIn(keys, ['layerId'])) return `Moved ${subject} to another layer`;
  if (allIn(keys, ['groupId'])) {
    const grouped = uniformAfter(pairs, (el) =>
      'groupId' in el ? Boolean((el as { groupId?: string }).groupId) : false,
    );
    if (grouped !== undefined) return `${grouped ? 'Grouped' : 'Ungrouped'} ${subject}`;
  }
  if (allIn(keys, TEXT_STYLE_KEYS)) return `Restyled the text on ${subject}`;
  if (allArrows && allIn(keys, ['labelOffset'])) return `Moved the label on ${subject}`;
  // strokeWidth / strokeStyle are shared between boxes and arrows, so
  // the box-specific "border" phrase only applies when no arrow is in
  // the set; anything else in this family reads as "Restyled". Arrow
  // LINE presets (spec/48) set flow / flowSpeed alongside the style
  // fields, so those ride along for an all-arrow set — but only when
  // a style key is present, so a pure flow toggle still reads as an
  // animation change below.
  const arrowRestyleKeys = allArrows
    ? [...ARROW_STYLE_KEYS, 'flow', 'flowSpeed']
    : ARROW_STYLE_KEYS;
  if (
    allIn(keys, [...BORDER_KEYS, ...arrowRestyleKeys]) &&
    [...keys].some((k) => !['flow', 'flowSpeed'].includes(k))
  ) {
    const noArrows = afters.every((el) => el.type !== 'arrow');
    if (noArrows && allIn(keys, BORDER_KEYS)) return `Changed the border of ${subject}`;
    return `Restyled ${subject}`;
  }
  if (allIn(keys, ANIMATION_KEYS)) return `Changed the animation on ${subject}`;
  if (allIn(keys, ICON_KEYS)) return `Changed the icon on ${subject}`;
  if (allIn(keys, CHART_KEYS)) return `Edited the chart data on ${subject}`;
  if (allIn(keys, TABLE_CELL_KEYS)) return `Edited cells in ${subject}`;
  if (allIn(keys, TABLE_STYLE_KEYS)) return `Restyled ${subject}`;
  if (allIn(keys, ['colWidths', 'rowHeights', ...SIZE_KEYS])) return `Resized ${subject}`;
  if (allIn(keys, ['progress'])) {
    const progress = uniformAfter(pairs, (el) =>
      'progress' in el ? (el as { progress?: number }).progress : undefined,
    );
    return progress === undefined
      ? `Changed the progress on ${subject}`
      : `Set the progress on ${subject} to ${progress}%`;
  }
  if (allIn(keys, ['rating'])) {
    const rating = uniformAfter(pairs, (el) =>
      'rating' in el ? (el as { rating?: number }).rating : undefined,
    );
    return rating === undefined
      ? `Changed the rating on ${subject}`
      : `Set the rating on ${subject} to ${rating}/5`;
  }
  if (allIn(keys, ['railCount', 'railLabels', ...SIZE_KEYS]))
    return `Edited the points on ${subject}`;
  if (keys.has('points') && allIn(keys, SKETCH_KEYS)) return `Reshaped ${subject}`;
  if (allIn(keys, ['commentThread'])) return `Updated comments on ${subject}`;
  if (allIn(keys, ['action'])) {
    const had = pairs.every((p) => 'action' in p.before && p.before.action);
    const has = pairs.every((p) => 'action' in p.after && p.after.action);
    if (!had && has) return `Assigned an action on ${subject}`;
    if (had && !has) return `Removed the action from ${subject}`;
    return `Updated the action on ${subject}`;
  }
  if (allIn(keys, ['aspectLocked'])) {
    const lockedAspect = uniformAfter(pairs, (el) =>
      'aspectLocked' in el ? (el as { aspectLocked?: boolean }).aspectLocked === true : false,
    );
    if (lockedAspect !== undefined) {
      return `${lockedAspect ? 'Locked' : 'Unlocked'} the aspect ratio of ${subject}`;
    }
  }
  return `Edited ${subject}`;
}

// --- The entry summary -------------------------------------------------------

// One-line summary for a whole commit. Pure adds / deletes name what
// landed or left; pure edits get the sharp verb above; a mixed commit
// spells out each part ("Added a Square & deleted an Arrow") instead
// of hiding behind "Edited".
export function summarizeChange(
  kind: ChangeLogKind,
  added: Element[],
  removed: Element[],
  edited: EditedPair[],
): string {
  if (kind === 'add') {
    return `Added ${added.length === 1 ? describeOne(added[0]!) : describeMany(added)}`;
  }
  if (kind === 'delete') {
    return `Deleted ${removed.length === 1 ? describeOne(removed[0]!) : describeMany(removed)}`;
  }
  if (edited.length > 0 && added.length === 0 && removed.length === 0) {
    return summarizeEdits(edited);
  }
  // One-for-one swap reads best as a replacement — the shape
  // recogniser (sketch → shape) is the everyday case.
  if (added.length === 1 && removed.length === 1 && edited.length === 0) {
    return `Replaced ${describeOne(removed[0]!)} with ${describeOne(added[0]!)}`;
  }
  const parts: string[] = [];
  if (added.length > 0) parts.push(`Added ${describeMany(added)}`);
  if (removed.length > 0) parts.push(`deleted ${describeMany(removed)}`);
  if (edited.length > 0) parts.push(`edited ${describeMany(edited.map((p) => p.after))}`);
  if (parts.length === 0) return 'Edited the tab';
  const first = parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1);
  if (parts.length === 1) return first;
  if (parts.length === 2) return `${first} & ${parts[1]}`;
  return `${first}, ${parts[1]} & ${parts[2]}`;
}
