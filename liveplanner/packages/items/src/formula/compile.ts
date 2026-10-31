// A stored formula parsed once (docs/specs/026-plan/item-types.md "Formula fields", Performance): its tree, the field
// ids it reads and whether it reads today, cached by its stored text (the same text is the same tree), so a board of
// n cards parses each formula once and only evaluates per card. The cache is bounded (FORMULA_CACHE_MAX), oldest out.
import { FORMULA_CACHE_MAX, FORMULA_MAX } from './limits';
import { parseFormula, refsOf, type FormulaNode } from './parse';

export type CompiledFormula =
  | { ok: true; tree: FormulaNode; ids: readonly string[]; usesToday: boolean }
  | { ok: false; error: string };

const cache = new Map<string, CompiledFormula>();

function readsToday(n: FormulaNode): boolean {
  if (n.k === 'call') return n.fn === 'today' || n.fn === 'days' || n.args.some(readsToday);
  if (n.k === 'neg') return readsToday(n.x);
  if (n.k === 'bin') return readsToday(n.a) || readsToday(n.b);
  return false;
}

function compile(stored: string): CompiledFormula {
  if (stored.length > FORMULA_MAX) return { ok: false, error: 'The formula is too long' };
  const tree = parseFormula(stored);
  if ('error' in tree) return { ok: false, error: tree.error };
  return { ok: true, tree, ids: refsOf(tree).map((r) => r.name), usesToday: readsToday(tree) };
}

export function compileFormula(stored: string): CompiledFormula {
  const hit = cache.get(stored);
  if (hit) return hit;
  const out = compile(stored);
  if (cache.size >= FORMULA_CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(stored, out);
  return out;
}
