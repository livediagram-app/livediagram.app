// A dragged element keeps its exact look (each editor's docs/specs/008-canvas/drag-preview.md "A dragged element keeps
// its look"). The canvas never draws an element as stored: it draws it as seen (its theme colours in the viewer's
// light or dark half, its stock colours for the canvas, a label re-inked against what is behind it). A gesture works
// on the stored elements, so the preview it makes carries the stored colours, and drawn as they were, a dragged
// element took its other half's colours (an indigo entity on a dark canvas turned pale indigo) until it was dropped.
//
// The fix is one rule, applied where every reader of a preview gets it (each editor's lib/drag-preview): an element
// the gesture changed is drawn as the canvas draws it at rest, with only what the gesture changed (its place, its
// size, its ends) taken from the preview. An element the gesture added (a Shift or Alt copy, a quick-connect arrow)
// has nothing drawn at rest, so it goes through the canvas's own projection, as the release will draw it.
//
// Cheap on purpose, as it runs on every frame of a drag: which fields the canvas's projection changed is worked out
// once per drawn element and cached, so a frame only compares those (a handful, often none) for each element it
// changes, and an element drawn as stored is passed through untouched. A move that only shifts elements then differs
// from the drawn board in position alone, so it rides its offset (drag-ride) instead of re-rendering each frame.

type Fields = Record<string, unknown>;

const NONE: readonly string[] = [];

// The fields the canvas's projection changed on one element: cached per drawn element, for the stored one it came from.
const projectedCache = new WeakMap<object, { stored: object; fields: readonly string[] }>();

export function projectedFields(stored: object, drawn: object): readonly string[] {
  if (stored === drawn) return NONE;
  const hit = projectedCache.get(drawn);
  if (hit && hit.stored === stored) return hit.fields;
  const s = stored as Fields;
  const d = drawn as Fields;
  const fields: string[] = [];
  for (const k of Object.keys(d)) if (d[k] !== s[k] || !(k in s)) fields.push(k);
  for (const k of Object.keys(s)) if (!(k in d)) fields.push(k);
  projectedCache.set(drawn, { stored, fields });
  return fields;
}

// `preview` (what the gesture made of `stored`) as the canvas draws it: each field the projection changed on `drawn`
// is taken from `drawn`, unless the gesture changed that field itself. The preview itself when nothing differs, so an
// element drawn as stored keeps its identity.
export function withDrawnLook<E extends object>(
  preview: E,
  stored: E | undefined,
  drawn: E | undefined,
): E {
  if (!stored || !drawn || stored === drawn || preview === drawn) return preview;
  const fields = projectedFields(stored, drawn);
  if (fields.length === 0) return preview;
  const p = preview as Fields;
  const s = stored as Fields;
  const d = drawn as Fields;
  let out: Fields | null = null;
  for (const k of fields) {
    // The gesture changed it (or the preview is already drawn, as a peer's is): the preview's value stands.
    if (p[k] !== s[k] || k in p !== k in s) continue;
    out ??= { ...p };
    if (k in d) out[k] = d[k];
    else delete out[k];
  }
  return (out as E | null) ?? preview;
}

export type DrawnLookOverlay<E> = {
  readonly changed: ReadonlyMap<string, E>;
  readonly added: readonly { readonly el: E; readonly after: string | null }[];
};

// An overlay as the canvas draws it: each changed element through withDrawnLook (`stored` the board the gesture is
// laid over, `drawn` the board the reader draws, both by id), each added one through `project` when the reader gives
// it. The overlay itself when nothing changes, so a board drawn as stored pays one lookup per changed element.
export function overlayAsDrawn<E extends { readonly id: string }, O extends DrawnLookOverlay<E>>(
  overlay: O,
  stored: ReadonlyMap<string, E>,
  drawn: ReadonlyMap<string, E>,
  project?: (el: E) => E,
): O {
  let changed: Map<string, E> | null = null;
  for (const [id, el] of overlay.changed) {
    const shown = withDrawnLook(el, stored.get(id), drawn.get(id));
    if (shown === el) continue;
    changed ??= new Map(overlay.changed);
    changed.set(id, shown);
  }
  let added: { el: E; after: string | null }[] | null = null;
  if (project)
    overlay.added.forEach((a, i) => {
      const el = project(a.el);
      if (el === a.el) return;
      added ??= overlay.added.slice();
      added[i] = { ...a, el };
    });
  if (!changed && !added) return overlay;
  return { ...overlay, ...(changed ? { changed } : {}), ...(added ? { added } : {}) };
}
