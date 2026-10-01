// The state one landing shares across its items (docs/specs/020-import-export/board-scene.md):
// a memoised colour resolver and the landing's own degraded and skipped rules, counted per rule.
import { createColourResolver, type ResolvedColour } from './colour';
import type { SceneColour, SceneNote } from './scene';

// The landing's own rules: final user-facing copy, counted per occurrence.
export const LANDING_RULES = {
  unreadableColour: "Colours that couldn't be read were drawn in ink",
  multicolourInk: 'Multicolour ink drawn in one colour',
  filledInk: 'Filled pen strokes drawn without their fill',
  dashedInk: 'Dashed pen strokes drawn solid',
  barHead: 'Bar arrowheads drawn as open arrowheads',
  twoHeads: 'Arrows with two different heads use one',
  bentArrow: 'Bent arrows drawn as curves',
  unsafeLink: "Links that aren't web addresses were dropped",
  unsized: 'Elements without a size were skipped',
  emptyText: 'Empty text boxes were skipped',
  longStroke: 'Very long strokes were simplified',
} as const;

export type LandContext = {
  /** A scene colour resolved; an unreadable one lands as ink and is counted. */
  colour: (c: SceneColour | 'ink' | undefined) => ResolvedColour | null;
  degrade: (rule: string) => void;
  skip: (rule: string) => void;
  /** The rules counted so far, in first-seen order. */
  notes: () => SceneNote[];
};

export function createLandContext(): LandContext {
  const resolve = createColourResolver();
  const counts = new Map<string, SceneNote>();
  const add = (rule: string, kind: 'degraded' | 'skipped') => {
    const key = `${kind}\u0000${rule}`;
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { rule, count: 1, kind });
  };
  const ctx: LandContext = {
    colour: (c) => {
      const out = resolve(c);
      if (out?.kind !== 'unreadable') return out;
      ctx.degrade(LANDING_RULES.unreadableColour);
      return { kind: 'ink' };
    },
    degrade: (rule) => add(rule, 'degraded'),
    skip: (rule) => add(rule, 'skipped'),
    notes: () => [...counts.values()].map((n) => ({ ...n })),
  };
  return ctx;
}
