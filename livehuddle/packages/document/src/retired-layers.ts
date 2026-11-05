// Layers are gone from livehuddle (docs/specs/006-document/layers.md "Documents saved with layers"). A tab saved
// while they existed may carry a `layers` array and a `layerId` on its elements: both are dropped, so every element
// is visible and free to pick. (A vote scoped to one layer went with the whole Vote, ./retired-vote.) Run on every stored
// or incoming tab by the stored-tab migration (./stored-tab), as ./retired-plan is, and on a peer's `tab-meta`
// patch, so no data migration is needed: a tab is read the new way wherever it is read, and saved the new way the
// next time it is saved. Pure; the same object back when there is nothing to drop, so the common read allocates
// nothing.
import { isRecord } from '@liveworkspace/model-core/is-record';

const carriesLayerId = (el: unknown): boolean => isRecord(el) && 'layerId' in el;

function withoutLayerId(el: unknown): unknown {
  if (!carriesLayerId(el)) return el;
  const { layerId: _layerId, ...rest } = el as Record<string, unknown>;
  return rest;
}

/** The tab without its layers or its elements' layer ids. */
export function dropRetiredLayers<T extends object>(tab: T): T {
  const t = tab as T & Record<string, unknown>;
  const layers = 'layers' in t;
  const elements = Array.isArray(t.elements) ? (t.elements as unknown[]) : undefined;
  const stamped = !!elements?.some(carriesLayerId);
  if (!layers && !stamped) return tab;
  const out = { ...t } as Record<string, unknown>;
  if (layers) delete out.layers;
  if (stamped) out.elements = elements!.map(withoutLayerId);
  return out as T;
}
