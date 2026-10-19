// What a typed input becomes, formulas included (docs/specs/029-sheets/formulas.md "What a typed input becomes"):
// the one door every input goes through (the editor, a paste, an import, an agent).
import { compileFormula, renderFormula, type SheetsCtx } from './formula/stored';
import type { ParseFailure } from './formula/parse';
import type { Node } from './formula/ast';
import { readLiteralInput, type FormatHint } from './input';
import { numberText } from './formula/values';
import { FORMULA_MAX, INPUT_MAX } from './limits';
import type { CellInput, NumberFormatKind } from './sheet';

export type TypedRead =
  | { kind: 'clear' }
  | { kind: 'value'; input: CellInput; hint?: FormatHint }
  | { kind: 'invalid'; reason: ParseFailure | 'input_too_long'; at: number };

export function readTypedInput(
  text: string,
  locale: string,
  ctx: SheetsCtx,
  asText = false,
): TypedRead {
  if (text.length > INPUT_MAX) return { kind: 'invalid', reason: 'input_too_long', at: INPUT_MAX };
  if (!asText && text.startsWith('=')) {
    if (text.length > FORMULA_MAX) return { kind: 'invalid', reason: 'too_long', at: FORMULA_MAX };
    const compiled = compileFormula(text, ctx);
    if (!compiled.ok) return { kind: 'invalid', reason: compiled.reason, at: compiled.at };
    const hint = formulaHint(compiled.ast);
    return { kind: 'value', input: { f: compiled.formula }, ...(hint ? { hint } : {}) };
  }
  return readLiteralInput(text, locale, asText);
}

// The format of what a formula's outermost function returns (docs/specs/029-sheets/formulas.md "What a typed input
// becomes"): `=TODAY()` drew as 46314. A whole number of days added to or taken from it (`=TODAY()+7`) keeps it; any
// other arithmetic (`=A1+7`, `=Due-TODAY()`, days left) and every other formula stay Automatic.
const FORMULA_FORMATS: Readonly<Record<string, NumberFormatKind>> = {
  TODAY: 'date',
  DATE: 'date',
  DATEVALUE: 'date',
  EDATE: 'date',
  EOMONTH: 'date',
  WORKDAY: 'date',
  NOW: 'datetime',
  TIME: 'time',
  TIMEVALUE: 'time',
};

function callFormat(node: Node): NumberFormatKind | undefined {
  return node.k === 'call' ? FORMULA_FORMATS[node.name.toUpperCase()] : undefined;
}

function formulaHint(ast: Node): FormatHint | undefined {
  let nf = callFormat(ast);
  if (!nf && ast.k === 'bin' && (ast.op === '+' || ast.op === '-')) {
    if (ast.b.k === 'num') nf = callFormat(ast.a);
    else if (ast.op === '+' && ast.a.k === 'num') nf = callFormat(ast.b);
  }
  return nf ? { nf, ifAutomatic: true } : undefined;
}

// An input as the formula bar shows it: a formula as A1 text, a number unformatted, a boolean in capitals.
export function inputAsText(input: CellInput | undefined, ctx: SheetsCtx): string {
  if (!input) return '';
  if ('f' in input) return renderFormula(input.f, ctx);
  if ('n' in input) return numberText(input.n);
  if ('b' in input) return input.b ? 'TRUE' : 'FALSE';
  // Text that would read as something else keeps a leading ' so editing it keeps it text.
  return input.s;
}
