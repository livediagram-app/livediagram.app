'use client';

// A question's own settings, inside its selected card (docs/specs/030-forms/forms.md "Question types"): a Number's
// bounds and Whole Numbers Only, a Multiple Choice's fewest and most picks, a Single Choice's
// Show as Dropdown, a Rating's scale, style and end labels. Each change one undo step.
import { withMax, withMin } from './question-range';
import {
  RATING_SCALE_DEFAULT,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
  SCALE_LABEL_MAX,
  type FormQuestion,
} from '@livedesign/forms';
import { Select, TextInput } from '@livedesign/ui';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { SettingsField } from '@/components/plan/settings-panel-parts';
import { updateQuestion } from '@livedesign/forms';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';

const FIELD_BOX =
  'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

// A whole number typed in, or none.
function NumberField({
  label,
  value,
  onChange,
  whole = true,
  min,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  whole?: boolean;
  min?: number;
}) {
  return (
    <SettingsField label={label}>
      <TextInput
        compact
        type="number"
        inputMode={whole ? 'numeric' : 'decimal'}
        step={whole ? 1 : 'any'}
        min={min}
        defaultValue={value ?? ''}
        key={value ?? 'none'}
        placeholder="None"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const n = Number(raw);
          if (raw === '') onChange(undefined);
          else if (Number.isFinite(n) && (!whole || Number.isInteger(n))) onChange(n);
          else e.target.value = value === undefined ? '' : String(value);
        }}
      />
    </SettingsField>
  );
}

export function QuestionSettings({ question: q }: { question: FormQuestion }) {
  const b = useFormBuilder();
  const set = (patch: Partial<Omit<FormQuestion, 'id' | 'type'>>) =>
    b.actions.changeForm((f) => updateQuestion(f, q.id, patch));
  const picks = (q.options?.length ?? 0) + (q.other ? 1 : 0);
  return (
    <div className="flex flex-col gap-3">
      {q.type === 'number' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Minimum"
              whole={false}
              value={q.min}
              onChange={(min) => set(withMin(q, min))}
            />
            <NumberField
              label="Maximum"
              whole={false}
              value={q.max}
              onChange={(max) => set(withMax(q, max))}
            />
          </div>
          <SwitchRow
            checked={!!q.whole}
            onChange={(on) => set({ whole: on || undefined })}
            className="py-1 text-[13px]"
          >
            Whole Numbers Only
          </SwitchRow>
        </>
      ) : null}
      {q.type === 'multi' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Fewest Picks"
            min={1}
            value={q.min}
            onChange={(min) => set(withMin(q, min && min <= picks ? min : undefined))}
          />
          <NumberField
            label="Most Picks"
            min={1}
            value={q.max}
            onChange={(max) => set(withMax(q, max && max <= picks ? max : undefined))}
          />
        </div>
      ) : null}
      {q.type === 'single' ? (
        <SwitchRow
          checked={!!q.dropdown}
          onChange={(on) => set({ dropdown: on || undefined })}
          className="py-1 text-[13px]"
        >
          Show as Dropdown
        </SwitchRow>
      ) : null}
      {q.type === 'rating' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SettingsField label="Scale">
              <Select
                className="w-full"
                selectClassName="text-[13px]"
                value={q.scale ?? RATING_SCALE_DEFAULT}
                onChange={(e) => set({ scale: Number(e.target.value) })}
              >
                {Array.from(
                  { length: RATING_SCALE_MAX - RATING_SCALE_MIN + 1 },
                  (_, i) => i + RATING_SCALE_MIN,
                ).map((n) => (
                  <option key={n} value={n}>
                    1 to {n}
                  </option>
                ))}
              </Select>
            </SettingsField>
            <SettingsField label="Style">
              <Select
                className="w-full"
                selectClassName="text-[13px]"
                value={q.style ?? 'stars'}
                onChange={(e) =>
                  set(
                    e.target.value === 'numbers'
                      ? { style: 'numbers' }
                      : { style: 'stars', lowLabel: undefined, highLabel: undefined },
                  )
                }
              >
                <option value="stars">Stars</option>
                <option value="numbers">Numbers</option>
              </Select>
            </SettingsField>
          </div>
          {q.style === 'numbers' ? (
            <div className="grid grid-cols-2 gap-2">
              <SettingsField label="Low Label">
                <div className={FIELD_BOX}>
                  <DraftText
                    value={q.lowLabel ?? ''}
                    maxLength={SCALE_LABEL_MAX}
                    label="Low label"
                    placeholder="Not at all"
                    onSave={(text) => set({ lowLabel: text.trim() || undefined })}
                  />
                </div>
              </SettingsField>
              <SettingsField label="High Label">
                <div className={FIELD_BOX}>
                  <DraftText
                    value={q.highLabel ?? ''}
                    maxLength={SCALE_LABEL_MAX}
                    label="High label"
                    placeholder="Very much"
                    onSave={(text) => set({ highLabel: text.trim() || undefined })}
                  />
                </div>
              </SettingsField>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// Whether a question has settings beyond its card's own controls (Required sits in the card's footer).
export const hasQuestionSettings = (q: FormQuestion): boolean =>
  ['number', 'multi', 'single', 'rating'].includes(q.type);
