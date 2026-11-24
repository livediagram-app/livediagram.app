// The Page Design panel's pure choices (docs/specs/011-theme/page-designs.md "Fine tuning"): which design the panel
// tunes for its scope, Reset, Shuffle and Try Another.
import {
  PAGE_DESIGN_BY_ID,
  compactPageDesign,
  designsOfFamily,
  isNoDesign,
  type PageDesign,
  type PageDesignOverride,
} from '@livedocuments/document';

export type DesignScope = 'tab' | 'page';

/** What the panel shows as worn: the tab's design, or the page's own (falling back to the tab's). */
export function wornDesign(
  scope: DesignScope,
  tabDesign: PageDesign | undefined,
  pageDesign: PageDesignOverride | undefined,
): PageDesign | undefined {
  if (scope === 'tab') return tabDesign;
  if (pageDesign === undefined) return tabDesign;
  return isNoDesign(pageDesign) ? undefined : pageDesign;
}

/** A design picked fresh: its own defaults, with the switches a person set on the tab kept. */
export function picked(id: PageDesign['id'], was: PageDesign | undefined): PageDesign {
  const def = PAGE_DESIGN_BY_ID[id];
  const out: PageDesign = { id };
  if (was?.colors) out.colors = was.colors;
  if (was?.rhythm) out.rhythm = true;
  if (was?.flow && def.flows) out.flow = true;
  if (was?.guard) out.guard = was.guard;
  if (was?.animate && def.animates) {
    out.animate = true;
    if (was.speed !== undefined) out.speed = was.speed;
  }
  return out;
}

/** Reset: the design's own defaults, keeping the design and its switches. */
export function reset(d: PageDesign): PageDesign {
  return picked(d.id, { ...d, colors: undefined });
}

/** A new seed, never the one it has. */
export function shuffled(d: PageDesign, roll: () => number = Math.random): PageDesign {
  const was = d.seed ?? 1;
  let seed = was;
  while (seed === was) seed = 1 + Math.floor(roll() * 9999);
  return compactPageDesign({ ...d, seed });
}

/** Try Another: the next design of the same family, keeping the tuning they share. */
export function another(d: PageDesign): PageDesign {
  const def = PAGE_DESIGN_BY_ID[d.id];
  const family = designsOfFamily(def.family);
  const next = family[(family.findIndex((m) => m.id === d.id) + 1) % family.length]!;
  const base = picked(next.id, d);
  for (const key of ['intensity', 'grain', 'calm'] as const)
    if (d[key] !== undefined) base[key] = d[key];
  for (const key of ['scale', 'angle', 'seed', 'blur'] as const)
    if (d[key] !== undefined && next.controls.includes(key)) base[key] = d[key];
  if (d.focus && next.controls.includes('focus')) base.focus = d.focus;
  return compactPageDesign(base);
}

/** The design with one field set (or cleared), stored small. */
export function tuned<K extends keyof PageDesign>(
  d: PageDesign,
  key: K,
  value: PageDesign[K] | undefined,
): PageDesign {
  const next = { ...d };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return compactPageDesign(next);
}
