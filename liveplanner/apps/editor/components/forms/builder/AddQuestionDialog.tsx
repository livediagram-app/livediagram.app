'use client';

// The Add a Question gallery (docs/specs/030-forms/forms.md "The form card, top to bottom"): the add bar's arrow opens
// a dialog of every question type, in groups (question-groups.ts), each tile with its picture (QuestionScene), its
// icon, its name and a line on what it collects, in the pickers' shared dialog (TilePicker).

import { useMemo } from 'react';
import { CONTENT_BLOCK_NAMES, QUESTION_TYPE_NAMES } from '@liveplanner/forms';
import { TilePicker, type PickerSection } from '@/components/tile-picker/TilePicker';
import { TONES, type SceneTone } from '@/components/tile-picker/tile-scene';
import { addQuestionHeroArt } from './AddQuestionHeroArt';
import { CONTENT_BLOCK_ICONS, QUESTION_TYPE_ICONS } from './question-icons';
import { QUESTION_GROUPS, QUESTION_LINES, contentKind, type AddKind } from './question-groups';
import { QuestionScene } from './QuestionScene';

type AskedKind = Exclude<AddKind, `content-${string}`>;

const kindName = (k: AddKind) => {
  const block = contentKind(k);
  return block ? CONTENT_BLOCK_NAMES[block] : QUESTION_TYPE_NAMES[k as AskedKind];
};

function TypeIcon({ type, tone }: { type: AddKind; tone: SceneTone }) {
  const block = contentKind(type);
  const Icon = block ? CONTENT_BLOCK_ICONS[block] : QUESTION_TYPE_ICONS[type as AskedKind];
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
  onPick: (type: AddKind) => void;
  onClose: () => void;
}) {
  const sections = useMemo<PickerSection<AddKind>[]>(
    () =>
      QUESTION_GROUPS.map((g) => ({
        id: g.id,
        name: g.name,
        tiles: g.types.map((t) => ({
          key: t,
          name: kindName(t),
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
      emptyHint="Try another word, such as “date”, “email”, “stars” or “picture”."
      sections={sections}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
