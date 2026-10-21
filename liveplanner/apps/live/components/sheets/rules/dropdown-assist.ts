// Typing in a dropdown cell (docs/specs/029-sheets/data-validation.md "Using a dropdown"): the options matching what
// is typed, those starting with it first, then those holding it, case aside; at most DROPDOWN_ASSIST_MAX.
import { rangeOptions, validationRuleAt, type Workbook } from '@liveplanner/sheets';

const DROPDOWN_ASSIST_MAX = 8;

export function dropdownMatches(
  wb: Workbook,
  sheetId: string,
  at: { r: number; c: number },
  draft: string,
): string[] | null {
  const sheet = wb.sheet(sheetId);
  const q = draft.trim().toLowerCase();
  if (!sheet || !q || draft.startsWith('=') || !sheet.layout.rules?.length) return null;
  const rule = validationRuleAt(sheet.layout, at.r, at.c);
  if (!rule || (rule.is !== 'list' && rule.is !== 'range')) return null;
  const all =
    rule.is === 'list'
      ? (rule.opts ?? []).map((o) => o.v)
      : rangeOptions(wb, sheetId, rule).map((o) => o.shown);
  const starts = all.filter((o) => o.toLowerCase().startsWith(q));
  const holds = all.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q));
  const found = [...starts, ...holds].slice(0, DROPDOWN_ASSIST_MAX);
  // Typed in full already: nothing to offer.
  if (found.length === 1 && found[0]!.toLowerCase() === q) return null;
  return found.length ? found : null;
}
