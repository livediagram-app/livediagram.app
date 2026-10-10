// Mirror While Drawing (docs/specs/007-editor/logo-pages.md "Mirror"): a commit that, while
// mirror is on, gives each element it newly adds its twins under its logo page's symmetry
// (vertical, horizontal, both or radial) and, with Merge on, merges them all into one element
// (mirror-merge), in the same commit (one undo). Wraps the commit the draw tools add through, so
// every way of drawing (a stroke, a recognised shape, a path, a dragged or placed shape) mirrors
// alike; edits to existing elements add nothing and pass through untouched.
import {
  isBoxed,
  mirroredPageAt,
  symmetryTwins,
  type Element,
  type LaidOutPage,
  type MirroredPage,
  type MirrorSettings,
  withMirrorSettings,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { mergeWithTwins } from './mirror-merge';

type Commit = (map: (els: Element[]) => Element[]) => void;

/** The elements `next` adds over `prev` with their twins; `next` itself when mirror adds
 *  nothing. */
export function withTwinsAdded(
  prev: readonly Element[],
  next: Element[],
  pages: readonly MirroredPage[],
): Element[] {
  if (next === prev) return next;
  const before = new Set(prev.map((el) => el.id));
  // Each new element merged with its twins into one (mergeWithTwins) while its page merges; where
  // it does not or cannot, the twins are added beside it.
  let changed = false;
  const twins: Element[] = [];
  const out = next.map((el) => {
    if (before.has(el.id) || !isBoxed(el)) return el;
    const made = symmetryTwins(el, pages);
    if (made.length === 0) return el;
    changed = true;
    const page = mirroredPageAt(pages, { x: el.x + el.width / 2, y: el.y + el.height / 2 });
    const merged = page?.mirror.merge ? mergeWithTwins(el, made) : null;
    if (merged) return merged;
    for (const twin of made) twins.push({ ...twin, id: crypto.randomUUID() });
    return el;
  });
  return changed ? [...out, ...twins] : next;
}

export function withMirrorTwins(
  commit: Commit,
  mirrored: { current: ReadonlyMap<string, MirrorSettings> },
  pages: { current: readonly LaidOutPage[] | null },
): Commit {
  return (map) => {
    // Only the pages Mirror While Drawing is on for make twins (it is per page).
    const ps = pages.current ? withMirrorSettings(pages.current, mirrored.current) : [];
    if (ps.length === 0) return commit(map);
    // Tracked from the updater, which React may run later (at render) or more than once (a strict
    // re-run, a rebase): the flag counts the edit once whenever it runs.
    let tracked = false;
    commit((els) => {
      const next = map(els);
      const out = withTwinsAdded(els, next, ps);
      if (out !== next && !tracked) {
        tracked = true;
        track('Element', 'Created', 'MirrorTwin');
      }
      return out;
    });
  };
}
