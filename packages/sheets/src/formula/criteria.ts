// Criteria (docs/specs/029-sheets/formulas.md "Functions": COUNTIF, SUMIFS, ... and the card functions): a value
// to equal, or text starting with a comparison (">=10", "<>Done"), with * and ? wildcards and ~ to escape them.
// Text matches ignore case.
import { parsePlainNumber } from '../input';
import { compareScalars, isError, type Scalar } from './values';

export type Criterion = (v: Scalar) => boolean;

// One step of a wildcard pattern: a character to equal (folded to lower case), any one character, or any run.
type WildStep = string | typeof ANY_ONE | typeof ANY_RUN;
const ANY_ONE = Symbol('?');
const ANY_RUN = Symbol('*');

// A criterion's wildcard pattern as steps, or null when it has no unescaped wildcard.
function wildcardSteps(pattern: string): WildStep[] | null {
  if (!/[*?]/.test(pattern.replace(/~[*?~]/g, ''))) return null;
  const steps: WildStep[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length && '*?~'.includes(pattern[i + 1]!)) {
      steps.push(pattern[++i]!);
    } else if (ch === '*') steps.push(ANY_RUN);
    else if (ch === '?') steps.push(ANY_ONE);
    // Folded as the text is (whole, then read a code unit at a time), so a letter whose lower case is longer still
    // lines up with it.
    else steps.push(...ch.toLowerCase().split(''));
  }
  return steps;
}

// Whether the whole of `text` matches the steps, ignoring case. Matched by hand rather than as a regular expression:
// each `*` only ever resumes from the last one, so a match costs at most text × pattern steps, where a backtracking
// regex of a few stars (`*a*a*a*a*b`) could run for minutes on every cell of a range.
function wildcardMatch(steps: readonly WildStep[], text: string): boolean {
  const t = text.toLowerCase();
  let ti = 0;
  let si = 0;
  let starAt = -1;
  let resumeAt = 0;
  while (ti < t.length) {
    const step = steps[si];
    if (step === ANY_RUN) {
      starAt = si++;
      resumeAt = ti;
    } else if (step !== undefined && (step === ANY_ONE || step === t[ti])) {
      si++;
      ti++;
    } else if (starAt >= 0) {
      si = starAt + 1;
      ti = ++resumeAt;
    } else return false;
  }
  while (steps[si] === ANY_RUN) si++;
  return si === steps.length;
}

function unescape(text: string): string {
  return text.replace(/~([*?~])/g, '$1');
}

export function makeCriterion(criterion: Scalar): Criterion {
  if (criterion === null) return (v) => v === null || v === '';
  if (typeof criterion === 'number' || typeof criterion === 'boolean')
    return (v) =>
      v !== null &&
      !isError(v) &&
      compareScalars(v, criterion) === 0 &&
      typeof v === typeof criterion;
  if (isError(criterion)) return (v) => isError(v) && v.e === criterion.e;
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(criterion)!;
  const op = m[1] ?? '=';
  const rest = m[2]!;
  const num = parsePlainNumber(rest);
  const bool = /^(true|false)$/i.test(rest) ? rest.toLowerCase() === 'true' : null;
  const operand: Scalar = num !== null ? num : bool !== null ? bool : rest;
  if (op === '=' || op === '<>') {
    let eq: Criterion;
    if (rest === '') eq = (v) => v === null || v === '';
    else if (typeof operand === 'string') {
      const steps = wildcardSteps(operand);
      const plain = unescape(operand).toLowerCase();
      eq = steps
        ? (v) => typeof v === 'string' && wildcardMatch(steps, v)
        : (v) => typeof v === 'string' && v.toLowerCase() === plain;
    } else {
      eq = (v) =>
        v !== null &&
        !isError(v) &&
        typeof v === typeof operand &&
        compareScalars(v, operand) === 0;
    }
    return op === '=' ? eq : (v) => !eq(v);
  }
  // An ordering compares only values of the operand's kind (">5" never matches text), as Sheets does.
  return (v) => {
    if (v === null || isError(v) || typeof v !== typeof operand) return false;
    const c = compareScalars(v, operand);
    switch (op) {
      case '<':
        return c < 0;
      case '>':
        return c > 0;
      case '<=':
        return c <= 0;
      default:
        return c >= 0;
    }
  };
}
