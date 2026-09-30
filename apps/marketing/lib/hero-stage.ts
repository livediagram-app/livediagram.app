// The hero stage's geometry in whole pixels (docs/specs/019-marketing/marketing-site.md). Each
// window is `cardPct`% of the stage with a `gapPct`% gutter; left as percentages, the centred
// window lands on a fractional pixel, and since the track is a composited layer the browser
// resamples everything on it there, so every word in the window goes soft. So the widths are
// rounded and the track's offset is snapped so the centred window's left edge falls on a whole
// page pixel, allowing for the stage's own fractional left edge (a centred max-width container
// sits on a half pixel in an odd-width viewport).

export type StageBox = { width: number; left: number };

export type SnappedStage = { cardPx: number; gapPx: number; translatePx: number };

export function snapStage(
  box: StageBox,
  cardPct: number,
  gapPct: number,
  active: number,
): SnappedStage {
  const cardPx = Math.round((box.width * cardPct) / 100);
  const gapPx = Math.round((box.width * gapPct) / 100);
  const ideal = (box.width - cardPx) / 2 - active * (cardPx + gapPx);
  const translatePx = Math.round(box.left + ideal) - box.left;
  return { cardPx, gapPx, translatePx };
}
