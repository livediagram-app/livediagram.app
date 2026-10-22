'use client';

// A Checklist card (docs/specs/026-plan/plan-tabs.md "Cards"): a heading with how many are done, and items ticked off
// in place. An Editor ticks, edits (Enter adds the next item, Backspace on an empty one removes it), and adds at the
// foot; each change is one step. Anyone else sees the ticks.
import { useRef, useState } from 'react';
import {
  DASHBOARD_CHECKLIST_ITEMS_MAX,
  DASHBOARD_CHECKLIST_ITEM_MAX,
  type DashboardChecklistItem,
} from '@liveplanner/project';
import { useDashboard } from './dashboard-context';
import { useSlotDraft } from './useSlotDraft';
import { CARD_BODY, CardHeading } from './card-parts';

const newId = () => crypto.randomUUID().slice(0, 8);

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition duration-micro motion-reduce:transition-none ${
        done
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
          : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
      }`}
    >
      {done ? (
        <svg
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2.5 6.2l2.2 2.2 4.8-5" />
        </svg>
      ) : null}
    </span>
  );
}

function ItemRow({
  item,
  canEdit,
  onChange,
  onRemove,
  onEnter,
}: {
  item: DashboardChecklistItem;
  canEdit: boolean;
  onChange: (next: DashboardChecklistItem) => void;
  onRemove: () => void;
  // Enter: the next item added after this one, with this one's edited text saved in the same step.
  onEnter: (text: string) => void;
}) {
  const [text, setText] = useSlotDraft(item.text);
  const textClass = `min-w-0 flex-1 bg-transparent text-[13px] outline-none ${
    item.done
      ? 'text-slate-400 line-through dark:text-slate-600'
      : 'text-slate-700 dark:text-slate-200'
  }`;
  return (
    <li className="flex items-center gap-2">
      {canEdit ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.text || 'Item'}
          onClick={() => onChange({ ...item, done: !item.done })}
          className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Tick done={item.done} />
        </button>
      ) : (
        <span role="img" aria-label={item.done ? 'Done' : 'Not done'}>
          <Tick done={item.done} />
        </span>
      )}
      {canEdit ? (
        <input
          aria-label="Item"
          data-checklist-item={item.id}
          value={text}
          maxLength={DASHBOARD_CHECKLIST_ITEM_MAX}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== item.text) onChange({ ...item, text });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter(text);
            }
            if (e.key === 'Backspace' && text === '') {
              e.preventDefault();
              onRemove();
            }
          }}
          placeholder="Something to do"
          className={`${textClass} placeholder:text-slate-400`}
        />
      ) : (
        <span className={`${textClass} truncate`}>{item.text}</span>
      )}
    </li>
  );
}

// An empty list's first item, for an Editor: a row ready to type into, not stored until it holds something. Leaving it
// with text adds the item; Enter adds it and opens the next.
function FirstItemRow({ onAdd }: { onAdd: (text: string, next: boolean) => void }) {
  const [text, setText] = useState('');
  return (
    <li className="flex items-center gap-2">
      <Tick done={false} />
      <input
        aria-label="Item"
        data-checklist-first
        value={text}
        maxLength={DASHBOARD_CHECKLIST_ITEM_MAX}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim()) onAdd(text, false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            e.preventDefault();
            onAdd(text, true);
          }
        }}
        placeholder="Something to do"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
      />
    </li>
  );
}

export function DashboardChecklistCard({
  slotId,
  checklist,
}: {
  slotId: string;
  checklist: { title: string; items: DashboardChecklistItem[] };
}) {
  const { canEdit, actions } = useDashboard();
  const listRef = useRef<HTMLUListElement>(null);
  const done = checklist.items.filter((i) => i.done).length;
  const save = (next: Partial<typeof checklist>) =>
    actions.setSlotContent(slotId, { type: 'checklist', ...checklist, ...next });
  const full = checklist.items.length >= DASHBOARD_CHECKLIST_ITEMS_MAX;
  // A new empty item after `index` (the end when -1), focused once it draws. `text` is the item at `index` as typed
  // (Enter in it), saved with the new one as one step; at the item limit it is saved alone.
  const addAfter = (index: number, text?: string) => {
    const items = checklist.items.map((x, i) =>
      i === index && text !== undefined && text !== x.text ? { ...x, text } : x,
    );
    if (full) {
      if (items.some((x, i) => x !== checklist.items[i])) save({ items });
      return;
    }
    const item = { id: newId(), text: '', done: false };
    items.splice(index < 0 ? items.length : index + 1, 0, item);
    save({ items });
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLInputElement>(`[data-checklist-item="${item.id}"]`)
        ?.focus(),
    );
  };
  return (
    <div className={CARD_BODY}>
      <CardHeading
        value={checklist.title}
        canEdit={canEdit}
        label="Checklist heading"
        onSave={(title) => save({ title })}
        aside={
          checklist.items.length > 0 ? (
            <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
              {done} of {checklist.items.length}
            </span>
          ) : null
        }
      />
      {checklist.items.length > 0 ? (
        <div
          aria-hidden
          className="h-1 w-full shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-short motion-reduce:transition-none"
            style={{ width: `${(done / checklist.items.length) * 100}%` }}
          />
        </div>
      ) : null}
      <ul ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {checklist.items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            onChange={(next) =>
              save({ items: checklist.items.map((x) => (x.id === item.id ? next : x)) })
            }
            onRemove={() => {
              save({ items: checklist.items.filter((x) => x.id !== item.id) });
              const prev = checklist.items[i - 1];
              if (prev)
                requestAnimationFrame(() =>
                  listRef.current
                    ?.querySelector<HTMLInputElement>(`[data-checklist-item="${prev.id}"]`)
                    ?.focus(),
                );
            }}
            onEnter={(text) => addAfter(i, text)}
          />
        ))}
        {checklist.items.length === 0 && canEdit ? (
          <FirstItemRow
            onAdd={(text, next) => {
              const first = { id: newId(), text, done: false };
              const second = { id: newId(), text: '', done: false };
              save({ items: next ? [first, second] : [first] });
              if (next)
                requestAnimationFrame(() =>
                  listRef.current
                    ?.querySelector<HTMLInputElement>(`[data-checklist-item="${second.id}"]`)
                    ?.focus(),
                );
            }}
          />
        ) : null}
        {checklist.items.length === 0 && !canEdit ? (
          <li className="text-[13px] text-slate-500 dark:text-slate-400">
            Nothing on the list yet.
          </li>
        ) : null}
      </ul>
      {/* Add Item once there is a first one; an empty list's first row is ready to type into instead. */}
      {canEdit && !full && checklist.items.length > 0 ? (
        <button
          type="button"
          onClick={() => addAfter(-1)}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-[12px] font-medium text-slate-500 transition hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <span aria-hidden className="text-[14px] leading-none">
            +
          </span>
          Add Item
        </button>
      ) : null}
    </div>
  );
}
