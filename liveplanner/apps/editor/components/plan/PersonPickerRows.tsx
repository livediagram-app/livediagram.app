'use client';

// The Assignee picker's rows (PersonPicker.tsx): No one, a person with the account mark, an AI assistant with the AI
// mark (docs/specs/026-plan/items.md "The Assignee picker"), and the custom row; and the AI Assistants heading, with its
// quiet line when the plan has no assistant yet. The heading is not an option, so the arrows and a screen reader's
// option count pass over it.
import { CheckIcon } from '@liveplanner/ui';
import { isAssistantId, type ItemPerson } from '@liveplanner/items';
import { ACCOUNT_MARK_LABEL, AccountMark, AssistantMark, hasAccountMark } from './AccountMark';
import { assistantLabel } from './PersonDisc';

export const ASSISTANTS_HEADING = 'AI Assistants';
export const NO_ASSISTANTS_LINE =
  'Connect an AI tool and ask it to look at this plan to hand it cards';

export function PersonOption({
  id,
  row,
  customText,
  selected,
  active,
  ticked,
  onPointerMove,
  onPick,
}: {
  id: string;
  // A person or assistant, No one (null), or the custom row.
  row: ItemPerson | null | 'custom';
  customText: string;
  selected: boolean;
  active: boolean;
  // Several: each person held is ticked.
  ticked: boolean;
  onPointerMove: () => void;
  onPick: () => void;
}) {
  const custom = row === 'custom';
  const person = custom ? null : row;
  const assistant = !!person && isAssistantId(person.id);
  const marked = !!person && !assistant && hasAccountMark(person);
  const text = custom ? customText : (person?.name ?? 'No one');
  // The name first, then what the mark says ("Sam, liveworkspace account", "Claude (Sam), AI assistant").
  const named = assistant
    ? assistantLabel({ name: text })
    : marked
      ? `${text}, ${ACCOUNT_MARK_LABEL}`
      : text;
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={named}
      onPointerMove={onPointerMove}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[13px] leading-snug max-sm:text-[16px] ${
        active ? 'bg-slate-100 dark:bg-slate-800' : ''
      } ${selected ? 'font-semibold' : ''} ${
        person ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {/* A real person's account mark, an assistant's sparkle, left of the name; a custom assignee keeps the same room
          empty so the names line up. No one and the custom row have neither. */}
      {assistant ? (
        <AssistantMark />
      ) : marked ? (
        <AccountMark />
      ) : person ? (
        <span aria-hidden className="size-3 shrink-0" />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {ticked ? (
        <span aria-hidden className="shrink-0 text-brand-700 dark:text-brand-400">
          <CheckIcon size={12} />
        </span>
      ) : null}
    </li>
  );
}

// The AI Assistants group's heading: a rule above it parts it from the people. With none yet, the quiet line says how
// an AI tool becomes one.
export function AssistantsHeading({ empty }: { empty: boolean }) {
  return (
    <li
      role="presentation"
      data-assistants-heading=""
      className="mt-1 border-t border-slate-100 px-2 pb-1 pt-2 dark:border-slate-800"
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {ASSISTANTS_HEADING}
      </span>
      {empty ? (
        <span className="mt-0.5 block text-[12px] leading-snug text-slate-500 max-sm:text-[14px] dark:text-slate-400">
          {NO_ASSISTANTS_LINE}
        </span>
      ) : null}
    </li>
  );
}
