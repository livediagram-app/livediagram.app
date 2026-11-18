'use client';

// The form as built (docs/specs/030-forms/forms.md "Building a form"): its header, the connect box under it while
// responses go nowhere, each section's questions (every section headed by its own card once there are several, each
// draggable and movable), and each section's add bar at its foot, in a column as wide as the form's Width.
// A press on the column's background deselects. Questions slide when moved and grow in when added (question-motion).
// Until the form's responses have somewhere to go (no board, no sheet chosen), its questions are shown but not
// editable and the add bar is gone: the connect box is the one thing to do first.
import { Fragment, useCallback, useMemo, useRef } from 'react';
import { CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideClipboardList } from '@liveworkspace/icons/lucide';
import type { DestinationProblem } from '@liveplanner/forms';
import { FORM_WIDTH_PX, placeQuestion, placeSection } from '@liveplanner/forms';
import { FormAddBar } from './FormAddBar';
import { FormConnectCard } from './FormConnectCard';
import { FormHeaderCard, SectionHeader } from './FormHeaderCard';
import { FormQuestionCard } from './FormQuestionCard';
import { FormBuilderContext, useFormBuilder } from './form-builder-context';
import { DescribeFormButton } from '../describe-form/DescribeFormButton';
import { useQuestionDrag } from './useQuestionDrag';
import { useSectionDrag } from './useSectionDrag';
import { useFlipList } from '@liveworkspace/workbench/hooks/ui/useFlipList';
import { QUESTION_FLIP } from './question-motion';

const QuestionIcon = lucideGlyph(lucideClipboardList, 20);

export function FormBuilderColumn({
  scrollRef,
  hasDestinations,
  problem = null,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  // Whether the project already has a board or sheet the form could send its responses to.
  hasDestinations: boolean;
  // Why its board or sheet no longer takes responses, for the connect box to say.
  problem?: DestinationProblem | null;
}) {
  const outer = useFormBuilder();
  // Nowhere chosen for responses yet: the questions wait, read-only, for the connect box.
  const waiting = outer.canEdit && !outer.form.destination && !outer.form.sheet;
  const b = useMemo(() => (waiting ? { ...outer, canEdit: false } : outer), [outer, waiting]);
  const columnRef = useRef<HTMLDivElement>(null);
  const onDrop = useCallback(
    (id: string, section: number, index: number) =>
      b.actions.changeForm((f) => placeQuestion(f, id, section, index)),
    [b.actions],
  );
  const drag = useQuestionDrag(columnRef, scrollRef, onDrop);
  const onSectionDrop = useCallback(
    (id: string, index: number) => b.actions.changeForm((f) => placeSection(f, id, index)),
    [b.actions],
  );
  const sectionDrag = useSectionDrag(columnRef, scrollRef, onSectionDrop);
  const mark = drag.mark ?? sectionDrag.mark;
  const all = b.form.sections.flatMap((s) => s.questions);
  const firstId = all[0]?.id;
  const lastId = all[all.length - 1]?.id;
  // Questions slide to a new place, and a new one grows in (question-motion.ts).
  const rowRef = useFlipList(
    all.map((q) => q.id),
    QUESTION_FLIP,
  );
  return (
    <div
      ref={columnRef}
      data-flip-root=""
      className="relative mx-auto flex w-full flex-col gap-3"
      style={{ maxWidth: FORM_WIDTH_PX[b.form.width ?? 'narrow'] }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) b.select(null);
      }}
    >
      {mark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[3] h-1 rounded-full bg-[var(--form-accent)]"
          style={{ top: mark.top }}
        />
      ) : null}
      <FormHeaderCard />
      <FormConnectCard hasExisting={hasDestinations} problem={problem} />
      <FormBuilderContext.Provider value={b}>
        <div
          className={`flex flex-col gap-3 ${waiting ? `pointer-events-none select-none ${all.length ? 'opacity-55' : ''}` : ''}`}
          aria-disabled={waiting || undefined}
          {...(waiting ? { inert: true } : {})}
        >
          {b.form.sections.map((section, s) => (
            <div
              key={section.id}
              data-form-section={s}
              data-form-section-id={section.id}
              className="flex flex-col gap-3"
            >
              {b.form.sections.length > 1 ? (
                <SectionHeader
                  section={section}
                  index={s}
                  count={b.form.sections.length}
                  onGrab={sectionDrag.grab}
                  dragging={sectionDrag.dragging === section.id}
                />
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
                  {...(b.canEdit && all.length === 0
                    ? {
                        description: 'Add one with the bar below.',
                        // Describe a Form (describe-a-form.md "Where it starts"): an empty form drafted by AI.
                        action: (
                          <DescribeFormButton className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-500/15" />
                        ),
                      }
                    : b.canEdit
                      ? { description: 'Add one with the bar below.' }
                      : waiting
                        ? { description: 'Choose where responses go above, then add questions.' }
                        : {})}
                />
              ) : null}
              <span data-form-section-end aria-hidden className="h-0" />
              {/* Every section ends with its own add bar: what it adds goes into this section. */}
              <FormAddBar section={section} index={s} />
            </div>
          ))}
        </div>
      </FormBuilderContext.Provider>
    </div>
  );
}
