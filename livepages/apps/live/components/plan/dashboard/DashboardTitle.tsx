'use client';

// A Title in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): a section's big heading over a line
// or two of description, sitting bare on the page (no card) so it reads as the heading of what follows. Its size
// follows the slot's width (a container query), never crowding a narrow slot. An Editor types into both in place; each
// lands as one step when the field is left. A faint dashed outline on hover says it can be written in.
import {
  DASHBOARD_NOTE_MAX,
  DASHBOARD_NOTE_TITLE_MAX,
  type DashboardCardStyle,
} from '@livepages/document';
import { useDashboard } from './dashboard-context';
import { useSlotDraft } from './useSlotDraft';

const HEADING =
  'w-full truncate bg-transparent text-[22px] font-semibold leading-tight tracking-tight text-slate-900 @md:text-[30px] dark:text-slate-50';
const DESCRIPTION =
  'w-full bg-transparent text-[14px] leading-relaxed text-slate-500 @md:text-[15px] dark:text-slate-400';

export function DashboardTitle({
  slotId,
  title: stored,
}: {
  slotId: string;
  // Its style rides along with each change (plan-tabs.md "Card style").
  title: { title: string; text: string; style?: DashboardCardStyle };
}) {
  const { canEdit, actions } = useDashboard();
  const [title, setTitle] = useSlotDraft(stored.title);
  const [text, setText] = useSlotDraft(stored.text);
  const save = () => {
    if (title === stored.title && text === stored.text) return;
    actions.setSlotContent(slotId, { ...stored, type: 'title', title, text });
  };
  if (!canEdit)
    return (
      <div className="@container flex h-full flex-col justify-center gap-1 overflow-hidden px-2 py-2">
        <h2 className={HEADING}>{stored.title}</h2>
        {stored.text ? (
          <p className={`${DESCRIPTION} line-clamp-3 whitespace-pre-wrap`}>{stored.text}</p>
        ) : null}
      </div>
    );
  return (
    <div className="@container flex h-full flex-col justify-center gap-1 rounded-2xl border border-dashed border-transparent px-2 py-2 pr-11 transition duration-micro hover:border-slate-300 focus-within:border-slate-300 motion-reduce:transition-none dark:hover:border-slate-700 dark:focus-within:border-slate-700">
      <input
        aria-label="Title heading"
        value={title}
        maxLength={DASHBOARD_NOTE_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        placeholder="Section Title"
        className={`${HEADING} outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600`}
      />
      <textarea
        aria-label="Title description"
        value={text}
        maxLength={DASHBOARD_NOTE_MAX}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={1}
        placeholder="Add a description…"
        className={`${DESCRIPTION} max-h-[4.5em] resize-none outline-none [field-sizing:content] placeholder:text-slate-400 dark:placeholder:text-slate-600`}
      />
    </div>
  );
}
