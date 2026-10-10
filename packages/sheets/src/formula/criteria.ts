// Criteria (docs/specs/029-sheets/formulas.md "Functions": COUNTIF, SUMIFS, ... and the card functions): a value
// to equal, or text starting with a comparison (">=10", "<>Done"), with * and ? wildcards and ~ to escape them.
// Text matches ignore case.
import { parsePlainNumber } from '../input';
import { compareScalars, isError, type Scalar } from './values';

export type Criterion = (v: Scalar) => boolean;

function wildcardRe(pattern: string): RegExp | null {
  if (!/[*?]/.test(pattern.replace(/~[*?~]/g, ''))) return null;
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length && '*?~'.includes(pattern[i + 1]!)) {
      re += `\\${pattern[++i]}`;
    } else if (ch === '*') re += '[\\s\\S]*';
    else if (ch === '?') re += '[\\s\\S]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
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
      const re = wildcardRe(operand);
      const plain = unescape(operand).toLowerCase();
      eq = re
        ? (v) => typeof v === 'string' && re.test(v)
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
