'use client';

// A section's add bar (docs/specs/030-forms/forms.md "The form card, top to bottom"), at the foot of every section so
// adding is always where the section ends: Add <Type> (the selected question's type while it is in this section, else
// Short Answer), its arrow opening the Add a Question gallery of every type and content block (AddQuestionDialog), and
// Add Section. A new question lands after the selected one when it is in this section, else at the section's end,
// selected and focused. Add Section splits this section after its selected question, else adds an empty one after it.
import { useState } from 'react';
import {
  QUESTION_TYPE_NAMES,
  QUESTION_TYPE_TELEMETRY,
  newFormPartId,
  type FormSection,
  type QuestionType,
} from '@liveplanner/forms';
import { ChevronDownIcon, PlusIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideSeparatorHorizontal } from '@liveworkspace/icons/lucide';
import { addQuestion, addSection, canAddQuestion, canAddSection } from '@liveplanner/forms';
import { track } from '@/lib/telemetry';
import { AddQuestionDialog } from './AddQuestionDialog';
import { contentKind, type AddKind } from './question-groups';
import { useFormBuilder } from './form-builder-context';

const SectionIcon = lucideGlyph(lucideSeparatorHorizontal, 16);

export function FormAddBar({ section, index }: { section: FormSection; index: number }) {
  const b = useFormBuilder();
  const [open, setOpen] = useState(false);
  if (!b.canEdit) return null;
  // The selected part, while it is in this section: what this bar adds goes after it.
  const selected = section.questions.find((q) => q.id === b.selectedId);
  const nextType: QuestionType = selected && selected.type !== 'content' ? selected.type : 'short';
  const add = (kind: AddKind) => {
    const id = newFormPartId('q');
    const block = contentKind(kind);
    const type: QuestionType = block ? 'content' : (kind as QuestionType);
    b.actions.changeForm(
      (f) =>
        addQuestion(f, type, selected?.id ?? null, () => id, {
          inSection: section.id,
          ...(block ? { block } : {}),
        }).form,
    );
    b.select(id, true);
    track(
      'Form',
      'Added',
      block ? `Content${block[0]!.toUpperCase()}${block.slice(1)}` : QUESTION_TYPE_TELEMETRY[type],
    );
  };
  const button =
    'flex h-9 cursor-pointer items-center gap-2 px-3.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div className="flex justify-center py-1">
      <div
        data-form-add=""
        data-form-add-section={index}
        role="group"
        aria-label={`Add to section ${index + 1}`}
        className="flex items-stretch overflow-hidden rounded-full border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
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
        <Tooltip label="More Question Types and Content">
          <button
            type="button"
            aria-label="More Question Types and Content"
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
            b.actions.changeForm(
              (f) => addSection(f, () => id, selected?.id ?? null, section.id).form,
            );
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
