'use client';

// Sheet Settings' Data Validation and Conditional Formatting sections (docs/specs/029-sheets/data-validation.md,
// conditional-formatting.md "Making and changing rules"): every rule as a row (its line and range), Edit (Sheet
// Settings closes, the rule's cells are selected and its editor opens against them), Go To and, for an Editor, Remove.
import { CloseIcon, Tooltip } from '@livedesign/ui';
import {
  formatRange,
  formatRuleLine,
  posRangeOf,
  renderFormula,
  ruleLine,
  type FormatRule,
  type IdRange,
  type ValidationRule,
} from '@livedesign/sheets';
import { useSheetController, type SheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';

export const NO_VALIDATION_RULES =
  "No validation rules yet. Select cells and choose Dropdown or Checkbox from the toolbar's Data menu.";
export const NO_FORMAT_RULES =
  "No format rules yet. Select cells and choose Conditional Formatting from the toolbar's Data menu.";
// For someone with no toolbar (a Participant, a Viewer): what is there, never how to do what they cannot.
export const NO_VALIDATION_RULES_READ = 'No validation rules.';
export const NO_FORMAT_RULES_READ = 'No format rules.';

// A validation rule's short line: "Dropdown: To Do, Doing, Done", "Checkbox", "Number between 1 and 10".
export function validationRuleShortLine(rule: ValidationRule, c: SheetController): string {
  if (rule.is === 'check') return 'Checkbox';
  if (rule.is === 'list') return `Dropdown: ${(rule.opts ?? []).map((o) => o.v).join(', ')}`;
  const line = ruleLine(rule, { locale: c.locale, layout: c.sheet.layout });
  // "Enter a number between 1 and 10" → "Number between 1 and 10".
  return rule.is === 'range'
    ? `Dropdown: ${line.replace(/^Choose one of the values in /, 'values in ')}`
    : line.replace(/^Enter (a |an )?/, '').replace(/^(\w)/, (m) => m.toUpperCase());
}

function RuleRows<T extends IdRange & { id: string }>({
  rules,
  lineOf,
  label,
  onEdit,
  onRemove,
  onClose,
  actions,
}: {
  rules: readonly T[];
  lineOf: (rule: T) => string;
  label: string;
  onEdit: (rule: T) => void;
  onRemove: (rule: T) => void;
  onClose: () => void;
  actions: SheetActions;
}) {
  const c = useSheetController();
  return (
    <ul aria-label={label} className="flex flex-col gap-1">
      {rules.map((rule) => {
        const at = posRangeOf(c.sheet.layout, rule);
        const line = lineOf(rule);
        return (
          <li
            key={rule.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                {line}
              </span>
              <span className="block font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {at ? formatRange(at) : ''}
              </span>
            </span>
            {at && c.canShape ? (
              <button
                type="button"
                aria-label={`Edit ${line}`}
                className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                onClick={() => {
                  actions.goTo(at);
                  onClose();
                  onEdit(rule);
                }}
              >
                Edit
              </button>
            ) : null}
            {at ? (
              <button
                type="button"
                aria-label={`Go To ${line}`}
                className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                onClick={() => {
                  actions.goTo(at);
                  onClose();
                  c.focusGrid();
                }}
              >
                Go To
              </button>
            ) : null}
            {c.canShape ? (
              <Tooltip label={`Remove ${line}`}>
                <button
                  type="button"
                  aria-label={`Remove ${line}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={() => onRemove(rule)}
                >
                  <CloseIcon size={11} />
                </button>
              </Tooltip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const empty = (text: string) => (
  <p className="px-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
);

export function SheetValidationRules({
  actions,
  onClose,
}: {
  actions: SheetActions;
  onClose: () => void;
}) {
  const c = useSheetController();
  const rules = c.sheet.layout.rules ?? [];
  if (!rules.length) return empty(c.canShape ? NO_VALIDATION_RULES : NO_VALIDATION_RULES_READ);
  return (
    <RuleRows
      rules={rules}
      label="Validation rules"
      lineOf={(r) => validationRuleShortLine(r, c)}
      onEdit={(r) => actions.openValidation('cell', { ruleId: r.id })}
      onRemove={(r) => actions.removeValidationRule(r.id)}
      onClose={onClose}
      actions={actions}
    />
  );
}

export function SheetFormatRuleList({
  actions,
  onClose,
}: {
  actions: SheetActions;
  onClose: () => void;
}) {
  const c = useSheetController();
  const rules = c.sheet.layout.formatRules ?? [];
  if (!rules.length) return empty(c.canShape ? NO_FORMAT_RULES : NO_FORMAT_RULES_READ);
  const lineOf = (r: FormatRule) =>
    formatRuleLine(r, r.fx ? renderFormula(r.fx, c.workbook.ctxFor(c.sheet.id)) : undefined);
  return (
    <RuleRows
      rules={rules}
      label="Format rules"
      lineOf={lineOf}
      onEdit={(r) => actions.openFormatRules('cell', { ruleId: r.id })}
      onRemove={(r) => actions.removeFormatRule(r.id)}
      onClose={onClose}
      actions={actions}
    />
  );
}
