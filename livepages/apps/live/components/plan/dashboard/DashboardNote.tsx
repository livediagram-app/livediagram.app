'use client';

// A note in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): a heading and short text. An Editor
// types into both in place; each lands as one step when the field is left.
import {
  DASHBOARD_NOTE_MAX,
  DASHBOARD_NOTE_TITLE_MAX,
  type DashboardCardStyle,
} from '@livediagram/document';
import { useDashboard } from './dashboard-context';
import { useSlotDraft } from './useSlotDraft';

export function DashboardNote({
  slotId,
  note,
}: {
  slotId: string;
  // Its style rides along with each change (plan-tabs.md "Card style").
  note: { title: string; text: string; style?: DashboardCardStyle };
}) {
  const { canEdit, actions } = useDashboard();
  const [title, setTitle] = useSlotDraft(note.title);
  const [text, setText] = useSlotDraft(note.text);
  const save = () => {
    if (title === note.title && text === note.text) return;
    actions.setSlotContent(slotId, { ...note, type: 'note', title, text });
  };
  if (!canEdit)
    return (
      <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-4">
        <h3 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
          {note.title}
        </h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {note.text}
        </p>
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-1.5 p-4 pr-11">
      <input
        aria-label="Note heading"
        value={title}
        maxLength={DASHBOARD_NOTE_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        placeholder="Heading"
        className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
      />
      <textarea
        aria-label="Note text"
        value={text}
        maxLength={DASHBOARD_NOTE_MAX}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        placeholder="Write a note…"
        className="min-h-0 w-full flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-300"
      />
    </div>
  );
}
