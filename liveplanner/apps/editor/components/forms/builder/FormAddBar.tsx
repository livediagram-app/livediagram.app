'use client';

// The add bar (docs/specs/030-forms/forms.md "The form card, top to bottom"): Add <Type> (the selected question's
// type), its arrow opening the Add a Question gallery of every type (AddQuestionDialog), and Add Section (which splits
// the form after the selected question). A new question lands after the selected one, selected and focused.
import { useState } from 'react';
import {
  QUESTION_TYPE_NAMES,
  QUESTION_TYPE_TELEMETRY,
  newFormPartId,
  type QuestionType,
} from '@liveplanner/forms';
import { ChevronDownIcon, PlusIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideSeparatorHorizontal } from '@liveworkspace/icons/lucide';
import {
  addQuestion,
  addSection,
  canAddQuestion,
  canAddSection,
  questionById,
} from '@liveplanner/forms';
import { track } from '@/lib/telemetry';
import { AddQuestionDialog } from './AddQuestionDialog';
import { useFormBuilder } from './form-builder-context';

const SectionIcon = lucideGlyph(lucideSeparatorHorizontal, 16);

export function FormAddBar() {
  const b = useFormBuilder();
  const [open, setOpen] = useState(false);
  if (!b.canEdit) return null;
  const selected = questionById(b.form, b.selectedId);
  const nextType: QuestionType = selected?.type ?? 'short';
  const add = (type: QuestionType) => {
    const id = newFormPartId('q');
    b.actions.changeForm((f) => addQuestion(f, type, b.selectedId, () => id).form);
    b.select(id, true);
    track('Form', 'Added', QUESTION_TYPE_TELEMETRY[type]);
  };
  const button =
    'flex h-10 cursor-pointer items-center gap-2 px-4 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div className="flex justify-center py-1">
      <div
        data-form-add=""
        className="flex items-stretch overflow-hidden rounded-full border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <button
          type="button"
          disabled={!canAddQuestion(b.form)}
          onClick={() => add(nextType)}
          className={`${button} pr-2`}
        >
          <PlusIcon size={16} />
          Add {QUESTION_TYPE_NAMES[nextType]}
        </button>
        <Tooltip label="More Question Types">
          <button
            type="button"
            aria-label="More Question Types"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={!canAddQuestion(b.form)}
            onClick={() => setOpen(true)}
            className={`${button} border-l border-slate-200 px-2.5 dark:border-slate-700`}
          >
            <ChevronDownIcon />
          </button>
        </Tooltip>
        <span aria-hidden className="w-px bg-slate-200 dark:bg-slate-700" />
        <button
          type="button"
          disabled={!canAddSection(b.form)}
          onClick={() => {
            const id = newFormPartId('s');
            b.actions.changeForm((f) => addSection(f, () => id, b.selectedId).form);
          }}
          className={button}
        >
          <SectionIcon aria-hidden />
          Add Section
        </button>
      </div>
      {open ? (
        <AddQuestionDialog
          onClose={() => setOpen(false)}
          onPick={(t) => {
            setOpen(false);
            add(t);
          }}
        />
      ) : null}
    </div>
  );
}
