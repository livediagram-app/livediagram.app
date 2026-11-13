'use client';

// The Add a Question gallery (docs/specs/030-forms/forms.md "The form card, top to bottom"): the add bar's arrow opens
// a dialog of every question type, in groups (question-groups.ts), each tile with its picture (QuestionScene), its
// icon, its name and a line on what it collects, in the pickers' shared dialog (TilePicker).

import { useMemo } from 'react';
import { QUESTION_TYPE_NAMES, type QuestionType } from '@liveplanner/forms';
import { TilePicker, type PickerSection } from '@/components/tile-picker/TilePicker';
import { TONES, type SceneTone } from '@/components/tile-picker/tile-scene';
import { addQuestionHeroArt } from './AddQuestionHeroArt';
import { QUESTION_TYPE_ICONS } from './question-icons';
import { QUESTION_GROUPS, QUESTION_LINES } from './question-groups';
import { QuestionScene } from './QuestionScene';

function TypeIcon({ type, tone }: { type: QuestionType; tone: SceneTone }) {
  const Icon = QUESTION_TYPE_ICONS[type];
  return (
    <span
      aria-hidden
      className={`grid size-6 shrink-0 place-items-center rounded-md ${TONES[tone].soft}`}
    >
      <Icon size={13} aria-hidden />
    </span>
  );
}

export function AddQuestionDialog({
  onPick,
  onClose,
}: {
  onPick: (type: QuestionType) => void;
  onClose: () => void;
}) {
  const sections = useMemo<PickerSection<QuestionType>[]>(
    () =>
      QUESTION_GROUPS.map((g) => ({
        id: g.id,
        name: g.name,
        tiles: g.types.map((t) => ({
          key: t,
          name: QUESTION_TYPE_NAMES[t],
          line: QUESTION_LINES[t],
          icon: <TypeIcon type={t} tone={g.tone} />,
          scene: <QuestionScene type={t} />,
        })),
      })),
    [],
  );
  return (
    <TilePicker
      title="Add a Question"
      line="What should people answer?"
      art={addQuestionHeroArt}
      noun="question type"
      emptyHint="Try another word, such as “date”, “email” or “stars”."
      sections={sections}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
