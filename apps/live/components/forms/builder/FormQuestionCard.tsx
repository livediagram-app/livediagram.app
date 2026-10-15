'use client';

// One question in the builder (docs/specs/030-forms/forms.md "The form card, top to bottom"). Unselected, it is
// exactly what respondents see (drawn disabled). Selected (a click, or Enter on it), it shows its editing chrome: an
// accent bar at its left, the prompt and help as editable text, its type, the options of a choice question, the
// answer control as respondents see it, its own settings, and a footer: where its answer goes (a badge opening Answer
// Goes To), Move, Duplicate, Delete and Required. Everything about a question is edited in its card.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  HELP_MAX,
  PROMPT_MAX,
  effectiveTarget,
  promptOf,
  type FormQuestion,
} from '@livediagram/forms';
import { ArrowDownIcon, ArrowUpIcon, DuplicateIcon, TrashIcon, lucideGlyph } from '@livediagram/ui';
import { lucideGripVertical } from '@livediagram/icons/lucide';
import { Tooltip } from '@livediagram/ui';
import {
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  neighbourOf,
  setOptions,
  setQuestionType,
  updateQuestion,
} from '@/hooks/forms/form-edits';
import { newFormPartId } from '@livediagram/forms';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { QuestionControl } from '../QuestionControl';
import { QuestionView } from '../QuestionView';
import { DraftText, type DraftTextHandle } from './DraftText';
import { OptionsEditor } from './OptionsEditor';
import { QuestionTypeMenu, TypeButtonFace } from './QuestionTypeMenu';
import { AnswerGoesTo } from './AnswerGoesTo';
import { FormSheet } from './FormSheet';
import { QuestionSettings, hasQuestionSettings } from './QuestionSettings';
import { useFormBuilder } from './form-builder-context';
import { leaveThen } from './question-motion';
import { targetLabel } from './target-label';

const GripIcon = lucideGlyph(lucideGripVertical, 16);
const newId = (prefix: 'q' | 's') => newFormPartId(prefix);

const ICON_BUTTON =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function FormQuestionCard({
  question: q,
  first,
  last,
  onGrab,
  dragging,
}: {
  question: FormQuestion;
  first: boolean;
  last: boolean;
  // A press on the drag handle (useQuestionDrag).
  onGrab: (e: PointerEvent, id: string) => void;
  dragging: boolean;
}) {
  const b = useFormBuilder();
  const selected = b.canEdit && b.selectedId === q.id;
  const promptRef = useRef<DraftTextHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Answer Goes To, open under its badge.
  const [goesTo, setGoesTo] = useState<HTMLButtonElement | null>(null);
  // A question just added takes focus on its prompt.
  useEffect(() => {
    if (b.focusId !== q.id || !selected) return;
    promptRef.current?.focus();
    cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    b.clearFocus();
  }, [b, q.id, selected]);

  const change = (fn: Parameters<typeof b.actions.changeForm>[0]) => b.actions.changeForm(fn);
  const target = effectiveTarget(q, b.type);
  const mapped = target.to === 'field' ? target.field : undefined;

  if (!selected) {
    return (
      <div
        ref={cardRef}
        data-form-question={q.id}
        role={b.canEdit ? 'button' : undefined}
        tabIndex={b.canEdit ? 0 : undefined}
        aria-label={b.canEdit ? `Edit question: ${promptOf(q)}` : undefined}
        onClick={b.canEdit ? () => b.select(q.id) : undefined}
        onKeyDown={
          b.canEdit
            ? (e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  b.select(q.id);
                }
              }
            : undefined
        }
        className={`group/q relative rounded-xl outline-none transition ${b.canEdit ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--form-accent)]' : ''} ${dragging ? 'opacity-40' : ''}`}
      >
        {b.canEdit ? (
          <button
            type="button"
            aria-label={`Move ${promptOf(q)}`}
            onPointerDown={(e) => onGrab(e, q.id)}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-1/2 top-0.5 z-[1] flex h-5 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded text-slate-300 opacity-0 transition hover:text-slate-500 group-hover/q:opacity-100 dark:text-slate-600"
          >
            <GripIcon className="rotate-90" />
          </button>
        ) : null}
        <div>
          <QuestionView
            question={q}
            value={undefined}
            other=""
            onChange={() => {}}
            onOther={() => {}}
            disabled
          />
        </div>
        {b.canEdit && target.broken ? (
          <p className="pointer-events-none absolute bottom-2 right-3 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            Goes to Description
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      data-form-question={q.id}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          b.select(null);
        } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          // Options handle their own Alt+arrows.
          if ((e.target as HTMLElement).closest('[role="list"]')) return;
          e.preventDefault();
          change((f) => moveQuestion(f, q.id, e.key === 'ArrowUp' ? -1 : 1));
        }
      }}
      className={`form-box form-ink relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ring-1 ring-black/[0.02] dark:border-slate-700 dark:bg-slate-900 ${dragging ? 'opacity-40' : ''}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--form-accent)]" />
      <button
        type="button"
        aria-label={`Move ${promptOf(q)}`}
        onPointerDown={(e) => onGrab(e, q.id)}
        className="absolute left-1/2 top-0.5 flex h-5 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded text-slate-300 hover:text-slate-500 dark:text-slate-600"
      >
        <GripIcon className="rotate-90" />
      </button>
      <div className="flex flex-col gap-3 px-6 pb-3 pt-6 max-sm:px-4">
        <div className="flex items-start gap-3 max-sm:flex-col">
          <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-3 py-2 ring-[var(--form-accent)] focus-within:ring-2 dark:bg-slate-800/60">
            <DraftText
              ref={promptRef}
              value={q.prompt}
              placeholder="Question"
              maxLength={PROMPT_MAX}
              multiline
              label="Question"
              className="text-[16px] font-medium text-slate-900 dark:text-slate-50"
              onSave={(text) => change((f) => updateQuestion(f, q.id, { prompt: text.trim() }))}
            />
          </div>
          <QuestionTypeMenu
            value={q.type}
            label="Question type"
            onPick={(t) => change((f) => setQuestionType(f, q.id, t))}
            className="flex h-10 w-48 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:border-slate-300 max-sm:w-full dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <TypeButtonFace type={q.type} />
          </QuestionTypeMenu>
        </div>
        <DraftText
          value={q.help ?? ''}
          placeholder="Description (optional)"
          maxLength={HELP_MAX}
          multiline
          label="Description"
          className="px-3 text-[14px] text-slate-600 dark:text-slate-300"
          onSave={(text) =>
            change((f) => updateQuestion(f, q.id, { help: text.trim() || undefined }))
          }
        />
        <div className="px-3">
          {q.type === 'single' || q.type === 'multi' ? (
            <OptionsEditor
              question={q}
              onOptions={(options) => {
                change((f) => setOptions(f, q.id, options));
                if (mapped) b.actions.syncFieldOptions(b.type!, mapped.id, options);
              }}
              onOther={(other) =>
                change((f) => updateQuestion(f, q.id, { other: other || undefined }))
              }
            />
          ) : (
            // The control alone, as respondents will see it: the prompt and help are edited just above.
            <div className="cursor-not-allowed opacity-80 [&>*]:pointer-events-none" aria-hidden>
              <QuestionControl
                question={q}
                value={undefined}
                other=""
                onChange={() => {}}
                onOther={() => {}}
                disabled
                labelledBy=""
                controlId={`preview-${q.id}`}
              />
            </div>
          )}
        </div>
        {hasQuestionSettings(q) ? (
          <div className="mx-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <QuestionSettings question={q} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
        {/* A Sheet takes every answer in its own column: nothing to map. */}
        {b.form.sheet ? (
          <span className="mr-auto text-[12px] text-slate-500 dark:text-slate-400">
            Its own column in the sheet
          </span>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={!!goesTo}
            onClick={(e) => {
              const button = e.currentTarget;
              setGoesTo((open) => (open ? null : button));
            }}
            className={`mr-auto flex min-h-8 min-w-0 max-w-[60%] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium leading-5 transition max-sm:max-w-full ${
              target.broken
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="shrink-0 text-slate-400">Answer goes to</span>
            <span className="min-w-0 truncate">{targetLabel(target)}</span>
          </button>
        )}
        {goesTo ? (
          <FormSheet anchor={goesTo} name="Answer Goes To" onClose={() => setGoesTo(null)}>
            <AnswerGoesTo question={q} onChosen={() => setGoesTo(null)} />
          </FormSheet>
        ) : null}
        <Tooltip label="Move Up">
          <button
            type="button"
            aria-label="Move Up"
            disabled={first}
            onClick={() => change((f) => moveQuestion(f, q.id, -1))}
            className={ICON_BUTTON}
          >
            <ArrowUpIcon size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Move Down">
          <button
            type="button"
            aria-label="Move Down"
            disabled={last}
            onClick={() => change((f) => moveQuestion(f, q.id, 1))}
            className={ICON_BUTTON}
          >
            <ArrowDownIcon size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Duplicate">
          <button
            type="button"
            aria-label="Duplicate"
            onClick={() => {
              // The copy's id is made here, so it can be selected once the change lands.
              const id = newId('q');
              change((f) => duplicateQuestion(f, q.id, () => id).form);
              b.select(id);
            }}
            className={ICON_BUTTON}
          >
            <DuplicateIcon size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Delete">
          <button
            type="button"
            aria-label="Delete question"
            onClick={() => {
              const next = neighbourOf(b.form, q.id);
              // It fades away first; the questions under it then slide up (question-motion.ts).
              leaveThen(cardRef.current, () => {
                change((f) => deleteQuestion(f, q.id));
                b.select(next);
              });
            }}
            className={ICON_BUTTON}
          >
            <TrashIcon size={16} />
          </button>
        </Tooltip>
        <span aria-hidden className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          type="button"
          role="switch"
          aria-checked={!!q.required}
          onClick={() =>
            change((f) => updateQuestion(f, q.id, { required: q.required ? undefined : true }))
          }
          className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Required
          <ToggleSwitch checked={!!q.required} label="" presentational />
        </button>
      </div>
    </div>
  );
}
