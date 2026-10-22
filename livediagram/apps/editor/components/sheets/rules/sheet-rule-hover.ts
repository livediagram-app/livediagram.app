// What hovering a cell whose value its validation rule does not allow says (docs/specs/029-sheets/data-validation.md
// "Drawing"): "Invalid: " and the rule's Help Text, else its line.
import {
  cellKey,
  displayValue,
  rangeOptions,
  ruleMessage,
  validationRuleAt,
  valueInvalid,
} from '@livediagram/sheets';
import type { SheetController } from '../sheet-controller';

export function invalidWhy(c: SheetController, r: number, col: number): string | null {
  const layout = c.sheet.layout;
  if (!layout.rules?.length) return null;
  const rule = validationRuleAt(layout, r, col);
  if (!rule) return null;
  const value = c.workbook.value(c.sheet.id, r, col);
  const f = c.sheet.cells.get(cellKey(layout.rows[r]!, layout.cols[col]!))?.format;
  const shown = displayValue(value, f, c.locale).text;
  const ctx = {
    locale: c.locale,
    layout,
    rangeValues: () => rangeOptions(c.workbook, c.sheet.id, rule),
  };
  return valueInvalid(rule, value, shown, ctx) ? `Invalid: ${ruleMessage(rule, ctx)}` : null;
}
