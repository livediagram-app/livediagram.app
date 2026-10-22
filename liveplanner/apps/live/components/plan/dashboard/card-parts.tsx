'use client';

// What the written cards share (docs/specs/026-plan/plan-tabs.md "Cards"): the heading an Editor types into in place
// (a plain heading to anyone else), landing as one step when left, and the card's padding, clear of the slot's menu.
import { DASHBOARD_CARD_TITLE_MAX } from '@liveplanner/project';
import { useSlotDraft } from './useSlotDraft';

export const CARD_BODY = 'flex h-full flex-col gap-2 overflow-hidden p-4';
const HEADING_TEXT = 'text-[15px] font-semibold text-slate-800 dark:text-slate-100';

export function CardHeading({
  value,
  canEdit,
  label,
  onSave,
  aside,
}: {
  value: string;
  canEdit: boolean;
  label: string;
  onSave: (title: string) => void;
  aside?: React.ReactNode;
}) {
  const [draft, setDraft] = useSlotDraft(value);
  return (
    <div className="flex min-w-0 items-baseline gap-2 pr-8">
      {canEdit ? (
        <input
          aria-label={label}
          value={draft}
          maxLength={DASHBOARD_CARD_TITLE_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="Heading"
          className={`min-w-0 flex-1 truncate bg-transparent outline-none placeholder:text-slate-400 ${HEADING_TEXT}`}
        />
      ) : (
        <h3 className={`min-w-0 flex-1 truncate ${HEADING_TEXT}`}>{value}</h3>
      )}
      {aside}
    </div>
  );
}
