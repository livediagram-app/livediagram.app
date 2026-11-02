// A junk rule and the notation scripts/junk-rules.ts prints it in, read back for `--pre`: a
// conjunction of one or two thresholds ("edge1 < 0.020 AND valIn > 0.450"), and rules joined by
// OR fire when any of them does.

/** One threshold on a feature: below `t` when `lt`, else above it. */
export type Cond = { f: string; lt: boolean; t: number };
export type Rule = Cond[];

const CONDITION = /^([A-Za-z_]\w*)\s*([<>])\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i;

export const showRule = (rule: Rule): string =>
  rule.map((c) => `${c.f} ${c.lt ? '<' : '>'} ${c.t.toFixed(3)}`).join(' AND ');

/** Rules in `showRule`'s notation, joined by OR; throws on a condition it cannot read or an unknown feature. */
export function parseRules(text: string, features: readonly string[]): Rule[] {
  return text.split(/\s+OR\s+/).map((rule) =>
    rule.split(/\s+AND\s+/).map((condition) => {
      const [, f, op, t] = CONDITION.exec(condition.trim()) ?? [];
      if (f === undefined || t === undefined)
        throw new Error(`not "<feature> < or > <number>": ${condition}`);
      if (!features.includes(f))
        throw new Error(`no feature ${f}; the rows have ${features.join(', ')}`);
      return { f, lt: op === '<', t: Number(t) };
    }),
  );
}
