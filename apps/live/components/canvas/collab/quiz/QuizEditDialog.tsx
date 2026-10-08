'use client';

import { useState } from 'react';
import { Button, CloseIcon, DialogHeader } from '@livediagram/ui';
import {
  clampQuizSeconds,
  compactQuizOptions,
  QUIZ_MAX_OPTIONS,
  QUIZ_OPTION_MAX_TEXT,
  QUIZ_SECONDS_CHOICES,
  quizOptionLetter,
  type ShapeElement,
} from '@livediagram/document';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import type { QuizDraft } from '@/hooks/canvas/useQuizElements';

// Edit Quiz (docs/specs/012-collaboration/quiz.md): the question, its answers
// with one marked correct, and how long the round stays open.
//
// A dialog rather than a context-menu section: an answer list with a Correct
// marker on one row is a small form, and the menu is too narrow to type a
// question into. Opened from the card's own `…`, and only to whoever may run
// the card, which is also the only place the right answer is ever shown
// before the reveal.

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'text-xs font-medium uppercase tracking-wider text-slate-500';

// The rows the dialog edits. At least two, so there is always somewhere to type.
function seedRows(element: ShapeElement): string[] {
  const options = element.quizOptions ?? [];
  return options.length >= 2 ? [...options] : [...options, '', ''].slice(0, 2);
}

export function QuizEditDialog({
  element,
  open,
  onClose,
  onSave,
}: {
  element: ShapeElement;
  open: boolean;
  onClose: () => void;
  onSave: (draft: QuizDraft) => void;
}) {
  const [question, setQuestion] = useState(element.label ?? '');
  const [rows, setRows] = useState<string[]>(() => seedRows(element));
  const [correct, setCorrect] = useState(element.quizCorrect ?? 0);
  const [seconds, setSeconds] = useState(clampQuizSeconds(element.quizSeconds));

  const compact = compactQuizOptions(rows, correct);
  const canSave = question.trim().length > 0 && compact !== null;
  // The time limit the card has, offered even when it is not one of the
  // standard choices (set by an older client, or the JSON).
  const secondChoices = QUIZ_SECONDS_CHOICES.includes(seconds)
    ? QUIZ_SECONDS_CHOICES
    : [...QUIZ_SECONDS_CHOICES, seconds].sort((a, b) => a - b);

  const removeRow = (i: number) => {
    setRows((r) => r.filter((_, j) => j !== i));
    // The marker follows its row, and falls to the first when its row goes.
    setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c));
  };

  const save = () => {
    if (!canSave || !compact) return;
    onSave({ question, options: compact.options, correct: compact.correct, seconds });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Edit Quiz" size="md">
      {/* A React portal still bubbles its events up the REACT tree, which here
          is the canvas element that owns the card. A double-click to select a
          word in an answer would otherwise put the element into label edit,
          which unmounts the face and this dialog with it (the same trap the
          ellipsis menu documents). */}
      <div
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader
            title="Edit Quiz"
            subtitle="One question, two to six answers. Saving resets the round."
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <CloseIcon size={16} />
            </button>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-6 py-5">
            <label className="block">
              <span className={labelClass}>Question</span>
              <textarea
                autoFocus
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask?"
                className={`${fieldClass} mt-1 resize-none`}
              />
            </label>
            <fieldset>
              <legend className={labelClass}>Answers</legend>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Pick the right one. Nobody else sees which until you reveal it.
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-center text-xs font-semibold text-slate-400">
                      {quizOptionLetter(i)}
                    </span>
                    <input
                      className={`${fieldClass} flex-1`}
                      value={row}
                      maxLength={QUIZ_OPTION_MAX_TEXT}
                      placeholder={`Answer ${quizOptionLetter(i)}`}
                      aria-label={`Answer ${quizOptionLetter(i)}`}
                      onChange={(e) =>
                        setRows((r) => r.map((v, j) => (j === i ? e.target.value : v)))
                      }
                    />
                    <label
                      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                        correct === i
                          ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-500/60 dark:bg-green-500/15 dark:text-green-300'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="quiz-correct"
                        className="accent-green-600"
                        checked={correct === i}
                        onChange={() => setCorrect(i)}
                      />
                      Correct
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove answer ${quizOptionLetter(i)}`}
                      disabled={rows.length <= 2}
                      onClick={() => removeRow(i)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="xs"
                className="mt-2"
                disabled={rows.length >= QUIZ_MAX_OPTIONS}
                onClick={() => setRows((r) => [...r, ''])}
              >
                Add Answer
              </Button>
            </fieldset>
            <label className="block">
              <span className={labelClass}>Time Limit</span>
              <select
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className={`${fieldClass} mt-1`}
              >
                {secondChoices.map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} seconds` : s % 60 === 0 ? `${s / 60} min` : `${s} seconds`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </div>
    </Dialog>
  );
}
