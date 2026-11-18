// Hiding an element hides what hangs off it (liveworkspace/docs/specs/006-media/walkthroughs.md "Hide From
// Recording"; owner, 2026-11-17): every arrow pinned to a hidden element, and every arrow pinned onto a hidden arrow,
// so no line is left pointing at nothing. Read from the tab's elements; anything not an arrow is left alone.

type Endish = { kind?: unknown; elementId?: unknown; arrowId?: unknown } | null | undefined;
type Arrowish = { id?: unknown; type?: unknown; from?: Endish; to?: Endish };

const target = (end: Endish): string | null => {
  if (!end) return null;
  if (end.kind === 'pinned' && typeof end.elementId === 'string') return end.elementId;
  if (end.kind === 'on-arrow' && typeof end.arrowId === 'string') return end.arrowId;
  return null;
};

/** `ids` and every arrow attached to them, directly or through another attached arrow. Linear per pass; passes stop
 *  when nothing is added (an arrow chain's depth, a handful at most). */
export function withAttachedArrows(
  elements: readonly unknown[],
  ids: ReadonlySet<string>,
): ReadonlySet<string> {
  if (ids.size === 0) return ids;
  const arrows: { id: string; ends: (string | null)[] }[] = [];
  for (const el of elements as readonly Arrowish[]) {
    if (el?.type !== 'arrow' || typeof el.id !== 'string') continue;
    arrows.push({ id: el.id, ends: [target(el.from), target(el.to)] });
  }
  if (arrows.length === 0) return ids;
  const out = new Set(ids);
  for (let grew = true; grew;) {
    grew = false;
    for (const a of arrows) {
      if (out.has(a.id)) continue;
      if (a.ends.some((e) => e !== null && out.has(e))) {
        out.add(a.id);
        grew = true;
      }
    }
  }
  return out.size === ids.size ? ids : out;
}
