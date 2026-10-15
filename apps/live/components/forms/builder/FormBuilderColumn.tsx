'use client';

// The form as built (docs/specs/030-forms/forms.md "Building a form"): its header, the connect box under it while responses go nowhere, each section's questions (a later
// section headed by its own card), and the add bar (under the selected question, else at the end), in a 640 px column.
// A press on the column's background deselects. Questions slide when moved and grow in when added (question-motion).
import { Fragment, useCallback, useRef } from 'react';
import { CompactEmptyState, lucideGlyph } from '@livediagram/ui';
import { lucideClipboardList } from '@livediagram/icons/lucide';
import { placeQuestion } from '@/hooks/forms/form-edits';
import { FormAddBar } from './FormAddBar';
import { FormConnectCard } from './FormConnectCard';
import { FormHeaderCard, SectionHeader } from './FormHeaderCard';
import { FormQuestionCard } from './FormQuestionCard';
import { useFormBuilder } from './form-builder-context';
import { useQuestionDrag } from './useQuestionDrag';
import { useFlipList } from '@/hooks/ui/useFlipList';
import { QUESTION_FLIP } from './question-motion';

const QuestionIcon = lucideGlyph(lucideClipboardList, 20);

export function FormBuilderColumn({
  scrollRef,
  hasDestinations,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  // Whether the document already has a board or sheet the form could send its responses to.
  hasDestinations: boolean;
}) {
  const b = useFormBuilder();
  const columnRef = useRef<HTMLDivElement>(null);
  const onDrop = useCallback(
    (id: string, section: number, index: number) =>
      b.actions.changeForm((f) => placeQuestion(f, id, section, index)),
    [b.actions],
  );
  const drag = useQuestionDrag(columnRef, scrollRef, onDrop);
  const all = b.form.sections.flatMap((s) => s.questions);
  const firstId = all[0]?.id;
  const lastId = all[all.length - 1]?.id;
  const selectedShown = all.some((q) => q.id === b.selectedId);
  // Questions slide to a new place, and a new one grows in (question-motion.ts).
  const rowRef = useFlipList(
    all.map((q) => q.id),
    QUESTION_FLIP,
  );
  return (
    <div
      ref={columnRef}
      data-flip-root=""
      className="relative mx-auto flex w-full max-w-[640px] flex-col gap-3"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) b.select(null);
      }}
    >
      {drag.mark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[3] h-1 rounded-full bg-[var(--form-accent)]"
          style={{ top: drag.mark.top }}
        />
      ) : null}
      <FormHeaderCard sections={b.form.sections.length} />
      <FormConnectCard hasExisting={hasDestinations} />
      {b.form.sections.map((section, s) => (
        <div
          key={section.id}
          data-form-section={s}
          data-form-section-id={section.id}
          className="flex flex-col gap-3"
        >
          {s > 0 ? (
            <SectionHeader section={section} index={s} count={b.form.sections.length} />
          ) : null}
          {section.questions.map((q) => (
            <Fragment key={q.id}>
              <div ref={rowRef(q.id)}>
                <FormQuestionCard
                  question={q}
                  first={q.id === firstId}
                  last={q.id === lastId}
                  onGrab={drag.grab}
                  dragging={drag.dragging === q.id}
                />
              </div>
              {/* The add bar follows the selected question: what it adds goes there. */}
              {q.id === b.selectedId ? <FormAddBar /> : null}
            </Fragment>
          ))}
          {section.questions.length === 0 ? (
            <CompactEmptyState
              className="form-box rounded-xl border border-dashed border-slate-300 bg-white/60 py-6 dark:border-slate-600 dark:bg-slate-900/40"
              icon={<QuestionIcon aria-hidden />}
              title={
                s === 0 && b.form.sections.length === 1
                  ? 'No questions yet'
                  : 'No questions in this section yet'
              }
              {...(b.canEdit ? { description: 'Add one with the bar below.' } : {})}
            />
          ) : null}
          <span data-form-section-end aria-hidden className="h-0" />
        </div>
      ))}
      {selectedShown ? null : <FormAddBar />}
    </div>
  );
}
