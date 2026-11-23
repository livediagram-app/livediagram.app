'use client';

// The label picker (docs/specs/030-knowledgebase/page-surface.md "Page labels"), opened from Add Label and Edit
// Labels in the meta row: a popover (a sheet on a phone) titled Labels. A field that finds or creates a label takes
// the focus; under it the knowledgebase's labels, those on the most pages first, each one press to put on the page or
// take off, so only labels already in use are suggested. Each row's pencil opens the label in place (LabelEditView).
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { labelKey, labelName, type KnowledgeLabel } from '@liveknowledge/document';
import { ResponsivePopover, TextInput } from '@liveknowledge/ui';
import { LabelDot } from './LabelPill';
import { LabelEditView } from './LabelEditView';
import {
  CreateLabelIcon,
  EditLabelIcon,
  LabelSearchIcon,
  LabelTickIcon,
} from './page-labels-icons';
import {
  useLabelActions,
  useLabelCounts,
  useLabelsByUse,
  usePageLabelIds,
} from './page-labels-state';

export type LabelPickerState = {
  open: boolean;
  anchor: HTMLElement | null;
  openFrom: (el: HTMLElement) => void;
  close: () => void;
};

// One picker for the meta row, whichever button opened it: making a page's first label swaps Add Label for the pills
// and Edit Labels, and the picker stays open across that swap (it "stays open for the next").
type Shared = { open: boolean; anchor: HTMLElement | null };
let shared: Shared = { open: false, anchor: null };
const listeners = new Set<() => void>();
const setShared = (next: Shared) => {
  shared = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => shared;

export function useLabelPicker(): LabelPickerState {
  const s = useSyncExternalStore(subscribe, read, read);
  return {
    open: s.open,
    anchor: s.anchor,
    openFrom: (el) => setShared({ open: true, anchor: el }),
    close: () => setShared({ ...shared, open: false }),
  };
}

/** The meta row's one picker. Its button gone (Add Label became Edit Labels), it moves to the one that stands now;
 *  another page, or the row leaving, closes it. */
export function LabelPickerHost() {
  const picker = useLabelPicker();
  const ids = usePageLabelIds();
  const pageId = useEditorChrome((s) => s.activeTab.id);
  useLayoutEffect(() => {
    if (!picker.open || picker.anchor?.isConnected !== false) return;
    const next = document.querySelector<HTMLElement>('[data-edit-labels], [data-add-label]');
    setShared(next ? { open: true, anchor: next } : { open: false, anchor: null });
  }, [ids, picker.open, picker.anchor]);
  useEffect(() => () => setShared({ open: false, anchor: null }), [pageId]);
  return <LabelPicker picker={picker} />;
}

export function LabelPicker({ picker }: { picker: LabelPickerState }) {
  const titleId = useId();
  return (
    <ResponsivePopover
      open={picker.open}
      onClose={picker.close}
      anchor={picker.anchor}
      titleId={titleId}
      width={320}
      align="start"
    >
      {picker.open ? <PickerBody titleId={titleId} /> : null}
    </ResponsivePopover>
  );
}

/** The labels a search shows: those whose name starts with it first, then those that hold it, each in use order. */
export function matchingLabels(labels: readonly KnowledgeLabel[], query: string): KnowledgeLabel[] {
  const q = labelKey(query.trim());
  if (!q) return [...labels];
  const starts: KnowledgeLabel[] = [];
  const holds: KnowledgeLabel[] = [];
  for (const label of labels) {
    const key = labelKey(label.name);
    if (key.startsWith(q)) starts.push(label);
    else if (key.includes(q)) holds.push(label);
  }
  return [...starts, ...holds];
}

const ROW =
  'flex min-h-9 w-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] text-slate-800 transition-colors duration-micro hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';
const EDIT_BUTTON =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 opacity-0 transition duration-micro hover:bg-slate-100 hover:text-slate-800 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-600 group-hover:opacity-100 phone:h-11 phone:w-11 phone:opacity-100 pointer-coarse:opacity-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

function PickerBody({ titleId }: { titleId: string }) {
  const labels = useLabelsByUse();
  const counts = useLabelCounts();
  const onPage = usePageLabelIds();
  const actions = useLabelActions();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // The field takes the focus as the picker opens and again on the way back from a label, after the popover's own
  // first focus.
  useEffect(() => {
    if (editing) return;
    const id = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [editing]);

  const shown = useMemo(() => matchingLabels(labels, query), [labels, query]);
  const typed = labelName(query);
  // Create, where no label is called what was typed (ignoring case).
  const creatable =
    typed !== undefined && !labels.some((l) => labelKey(l.name) === labelKey(typed));

  const editingLabel = editing ? labels.find((l) => l.id === editing) : undefined;
  if (editing && editingLabel)
    return (
      <LabelEditView
        titleId={titleId}
        label={editingLabel}
        pages={counts.get(editingLabel.id) ?? 0}
        labels={labels}
        actions={actions}
        onBack={() => setEditing(null)}
      />
    );

  // Offered only while `creatable`, so `typed` is a name.
  const create = () => {
    void actions.create(typed!);
    setQuery('');
  };
  const rows = () => [...list.current!.querySelectorAll<HTMLElement>('[data-label-row]')];
  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rows()[0]?.focus();
    } else if (e.key === 'Enter' && query.trim()) {
      // Enter does the first row: Create, or the best match.
      e.preventDefault();
      rows()[0]?.click();
    }
  };
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = all[at + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) next.focus();
    else if (e.key === 'ArrowUp') field.current?.focus();
  };

  return (
    <div data-label-picker="" className="flex flex-col gap-3">
      <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Labels
      </h2>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <LabelSearchIcon />
        </span>
        <TextInput
          ref={field}
          compact
          type="search"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="Find or Create a Label"
          aria-label="Find or Create a Label"
          className="pl-8"
        />
      </div>
      <div
        ref={list}
        role="group"
        aria-label="This Knowledgebase's Labels"
        onKeyDown={onListKey}
        className="-mx-1 flex max-h-72 flex-col gap-px overflow-y-auto overscroll-contain px-1 phone:max-h-[min(50vh,22rem)]"
      >
        {creatable ? (
          <button
            type="button"
            data-label-row=""
            data-label-create=""
            onClick={create}
            className={ROW}
          >
            <span className="text-brand-700 dark:text-brand-300">
              <CreateLabelIcon />
            </span>
            <span className="min-w-0 truncate">
              Create <span className="font-semibold">&ldquo;{typed}&rdquo;</span>
            </span>
          </button>
        ) : null}
        {shown.map((label) => {
          const on = onPage.includes(label.id);
          const pages = counts.get(label.id) ?? 0;
          return (
            <div key={label.id} className="group flex items-center gap-1">
              <button
                type="button"
                data-label-row=""
                data-label={label.id}
                aria-pressed={on}
                aria-label={`${label.name}, ${pages === 1 ? '1 page' : `${pages} pages`}`}
                onClick={() => actions.toggle(label.id)}
                className={ROW}
              >
                <LabelDot colour={label.colour} />
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                  {pages}
                </span>
                <span
                  aria-hidden
                  className={`flex w-4 shrink-0 justify-center text-brand-700 dark:text-brand-300 ${on ? '' : 'invisible'}`}
                >
                  <LabelTickIcon />
                </span>
              </button>
              <button
                type="button"
                data-label-edit=""
                aria-label={`Edit Label ${label.name}`}
                onClick={() => setEditing(label.id)}
                className={EDIT_BUTTON}
              >
                <EditLabelIcon />
              </button>
            </div>
          );
        })}
        {shown.length === 0 && !creatable ? (
          <p className="px-2 py-3 text-[13px] text-slate-600 dark:text-slate-400">
            {labels.length === 0
              ? 'No labels yet. Type a name to make the first.'
              : 'No label matches.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
