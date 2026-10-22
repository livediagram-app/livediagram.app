// What a Sheet's rules do (docs/specs/029-sheets/data-validation.md, conditional-formatting.md, sheet.md "Paint
// Format", "Formatting" Custom): built from the engine's rule commands and sent through the controller's write, so a
// toolbar button, a menu row and a key can never differ. Spread into useSheetActions.
import {
  clipFromRange,
  idRangeOf,
  makeAxisIds,
  pasteClip,
  removeValidation,
  setValidationRule,
  toggleCheckboxes,
  validationRuleAt,
  type FormatRule,
  type GridRange,
  type RuleSettings,
} from '@livedesign/sheets';
import type { SheetController } from '../sheet-controller';
import type { RuleAnchor } from './useSheetRulesState';

function primary(c: SheetController): GridRange {
  const ranges = c.selectionNow().ranges;
  return ranges[ranges.length - 1]!;
}

export function sheetRuleActions(c: SheetController) {
  const layout = () => c.sheet.layout;
  return {
    // ---- Checkboxes and dropdowns (an Editor's and a Participant's: cells) ----
    // Space or a press on a box: false when no checkbox cell is selected (Space then types a space).
    toggleCheckboxes(ranges: readonly GridRange[] = c.selectionNow().ranges): boolean {
      if (!c.canEdit) return false;
      const w = toggleCheckboxes(c.workbook, c.sheet.id, ranges);
      if (!w) return false;
      c.write(w, 'Cell');
      return true;
    },
    // Alt+Down, a press on a chip or an arrow: the cell's option list, when its rule is a dropdown.
    openDropdown(at: { r: number; c: number } = c.selectionNow().active): boolean {
      const rule = validationRuleAt(layout(), at.r, at.c);
      if (!c.canEdit || !rule || (rule.is !== 'list' && rule.is !== 'range')) return false;
      c.rules.setDropdown(at);
      return true;
    },
    // A pick from the option list (null: Clear), checked by the store against the cell's rule.
    pickOption(at: { r: number; c: number }, value: string | null): boolean {
      const r = layout().rows[at.r];
      const col = layout().cols[at.c];
      c.rules.setDropdown(null);
      if (!r || !col) return false;
      const ok = c.write(
        { kind: 'cells', cells: [{ r, c: col, i: value === null ? null : { s: value } }] },
        'Cell',
      );
      c.focusGrid();
      return ok;
    },
    // ---- Validation rules (an Editor's: the Sheet's shape) ----
    addCheckbox(range: GridRange = primary(c)): void {
      const made = setValidationRule(layout(), range, { is: 'check' });
      if (made) c.write(made.write, 'Validation');
    },
    setValidation(range: GridRange, settings: RuleSettings, id?: string): boolean {
      const made = setValidationRule(layout(), range, settings, Math.random, id);
      return made ? c.write(made.write, 'Validation') : false;
    },
    removeValidation(ranges: readonly GridRange[] = c.selectionNow().ranges): void {
      const w = removeValidation(layout(), ranges);
      if (w) c.write(w, 'Validation');
    },
    removeValidationRule(id: string): void {
      c.write({ kind: 'layout', changes: [{ k: 'vrule', id, rule: null }] }, 'Validation');
    },
    openValidation(anchor: RuleAnchor, opts: { ruleId?: string; start?: 'list' } = {}): void {
      c.rules.setPanel({ kind: 'validation', anchor, ...opts });
    },
    // ---- Format rules (an Editor's) ----
    openFormatRules(anchor: RuleAnchor, opts: { ruleId?: string; all?: boolean } = {}): void {
      c.rules.setPanel({ kind: 'format', anchor, ...opts });
    },
    // A new rule's id (unique among the sheet's format rules).
    newFormatRuleId(): string {
      return makeAxisIds(
        1,
        Math.random,
        new Set((layout().formatRules ?? []).map((x) => x.id)),
      )[0]!;
    },
    setFormatRule(rule: FormatRule): boolean {
      return c.write(
        { kind: 'layout', changes: [{ k: 'frule', id: rule.id, rule }] },
        'ConditionalFormat',
      );
    },
    removeFormatRule(id: string): void {
      c.write({ kind: 'layout', changes: [{ k: 'frule', id, rule: null }] }, 'ConditionalFormat');
    },
    // Move Up (-1) and Move Down (1) in the list order.
    moveFormatRule(id: string, dir: -1 | 1): void {
      const ids = (layout().formatRules ?? []).map((x) => x.id);
      const at = ids.indexOf(id);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= ids.length) return;
      [ids[at], ids[to]] = [ids[to]!, ids[at]!];
      c.write({ kind: 'layout', changes: [{ k: 'fruleOrder', ids }] }, 'ConditionalFormat');
    },
    // The ids of a positional range on this sheet, for a rule's corners.
    rangeIds(range: GridRange) {
      return idRangeOf(layout(), range.r1, range.c1, range.r2, range.c2);
    },
    // ---- Custom number format ----
    openCustomFormat(anchor: RuleAnchor): void {
      c.rules.setPanel({ kind: 'customFormat', anchor });
    },
    // ---- Paint Format (an Editor's, as the toolbar is) ----
    paintStart(keep: boolean): void {
      const clip = clipFromRange(c.workbook, c.sheet.id, primary(c));
      if (clip) c.rules.setPaint({ clip, keep });
    },
    paintStop(): void {
      c.rules.setPaint(null);
    },
    // The selection just made takes the held formats; Paint Format then lets go unless it is kept.
    paintApply(range: GridRange): void {
      const paint = c.rules.paint;
      if (!paint) return;
      const made = pasteClip(c.workbook, c.sheet.id, range, paint.clip, 'formats');
      if (made?.edits.length) c.writeAll(made.edits, 'Format');
      if (!paint.keep) c.rules.setPaint(null);
    },
  };
}
