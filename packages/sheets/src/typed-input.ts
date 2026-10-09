// What a typed input becomes, formulas included (docs/specs/029-sheets/formulas.md "What a typed input becomes"):
// the one door every input goes through (the editor, a paste, an import, an agent).
import { compileFormula, renderFormula, type SheetsCtx } from './formula/stored';
import type { ParseFailure } from './formula/parse';
import { readLiteralInput, type FormatHint } from './input';
import { numberText } from './formula/values';
import { FORMULA_MAX, INPUT_MAX } from './limits';
import type { CellInput } from './sheet';

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
    return { kind: 'value', input: { f: compiled.formula } };
  }
  return readLiteralInput(text, locale, asText);
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
