// A tab's own fields read the way every renderer assumes them (docs/specs/006-project/layers.md
// "Data model"): the stored-tab migration runs this, so a tab that arrives with a malformed
// field (an api write, a peer's patch, a file) is repaired on the way in, and one already stored
// is repaired as it is read. Most tab fields already have a defensive reader (`tagColoursOf`,
// `readDashboard`, ...); these are the ones read raw. Fields of retired features (a tab's pages and
// their writing) are dropped as they are read.
import type { Layer } from './layers';
import { isRecord } from '@liveworkspace/model-core/is-record';
import { CUSTOM_FIELD_ID_PATTERN } from '@liveplanner/items';

type SettledFields = {
  layers?: unknown;
  backgroundColor?: unknown;
  patternColor?: unknown;
  vote?: unknown;
  pages?: unknown;
  articles?: unknown;
  pageOrientation?: unknown;
};

// What a tab carried for Pages mode, which nothing reads any more.
const RETIRED_FIELDS = ['pages', 'articles', 'pageOrientation'] as const;

// A dot vote as its tallies read it (docs/specs/012-collaboration/session-tools.md): `votes` a map of element id to
// the voters' ids. A vote that is not an object is no vote; its map's entries that are not lists of ids are
// dropped, and a map that is not one reads as no dots. The same vote back when nothing needed doing.
// Its `voteField` (Count In) is a custom field's id or nothing: anything else is dropped, so the tally counts in the
// built-in Votes.
function settleVote(v: unknown): unknown {
  if (!isRecord(v)) return undefined;
  const field = v.voteField;
  if (field !== undefined && !(typeof field === 'string' && CUSTOM_FIELD_ID_PATTERN.test(field))) {
    const { voteField: _dropped, ...rest } = v;
    return settleVote(rest);
  }
  const votes = v.votes;
  if (!isRecord(votes)) return { ...v, votes: {} };
  const ok = (ids: unknown) => Array.isArray(ids) && ids.every((id) => typeof id === 'string');
  if (Object.values(votes).every(ok)) return v;
  return { ...v, votes: Object.fromEntries(Object.entries(votes).filter(([, ids]) => ok(ids))) };
}

// A layer as the renderers read it: a non-empty string id, seen once; a string name; the optional
// flags and opacity only when they have their types. Null when nothing of it is readable.
function settleLayer(v: unknown, index: number, seen: Set<string>): Layer | null {
  if (!isRecord(v) || typeof v.id !== 'string' || v.id === '' || seen.has(v.id)) return null;
  seen.add(v.id);
  const layer: Layer = {
    id: v.id,
    name: typeof v.name === 'string' ? v.name : `Layer ${index + 1}`,
  };
  if (typeof v.visible === 'boolean') layer.visible = v.visible;
  if (typeof v.locked === 'boolean') layer.locked = v.locked;
  if (typeof v.opacity === 'number' && Number.isFinite(v.opacity))
    layer.opacity = Math.min(1, Math.max(0, v.opacity));
  return layer;
}

function layerIsSettled(v: unknown, settled: Layer): boolean {
  const r = v as Record<string, unknown>;
  return (
    r.name === settled.name &&
    r.opacity === settled.opacity &&
    Object.keys(r).every((k) => k in settled)
  );
}

/** The tab with its raw-read fields settled: `layers` an array of readable layers (absent when
 *  none is), the background and pattern colours strings or absent, a dot vote's tallies lists of ids. The same object when nothing
 *  needed doing, so the common read allocates nothing. */
export function settleTabFields<T extends object>(tab: T): T {
  const t = tab as T & SettledFields;
  const drop: (keyof SettledFields)[] = [];
  let layers: Layer[] | undefined;
  if (t.backgroundColor !== undefined && typeof t.backgroundColor !== 'string')
    drop.push('backgroundColor');
  if (t.patternColor !== undefined && typeof t.patternColor !== 'string') drop.push('patternColor');
  for (const k of RETIRED_FIELDS) if (t[k] !== undefined) drop.push(k);
  // The vote is settled into a copy below, so `vote` is never in `drop`.
  const vote = t.vote === undefined ? undefined : settleVote(t.vote);
  if (t.layers !== undefined) {
    if (!Array.isArray(t.layers)) drop.push('layers');
    else {
      const seen = new Set<string>();
      const read = t.layers.map((v, i) => settleLayer(v, i, seen));
      const kept = read.filter((l): l is Layer => l !== null);
      const stored = t.layers;
      const same = read.every((l, i) => l !== null && layerIsSettled(stored[i], l));
      if (kept.length === 0) drop.push('layers');
      else if (!same) layers = kept;
    }
  }
  if (drop.length === 0 && !layers && vote === t.vote) return tab;
  const out = { ...t } as Record<string, unknown>;
  for (const k of drop) delete out[k];
  if (layers) out.layers = layers;
  if (vote === undefined) delete out.vote;
  else out.vote = vote;
  return out as T;
}
