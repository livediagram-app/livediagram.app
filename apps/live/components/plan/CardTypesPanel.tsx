'use client';

// The Card Types panel (docs/specs/026-plan/item-types.md "The Card Types panel"): the document's item
// types, each with its glyph and colour, its name and how many items have it. A popover hanging above
// its button in Plan mode's bottom-right cluster. Edit and Add Type open the type editor, Duplicate opens it on a
// new type filled from that one; Restore built-in types puts the built-ins back. Someone who may only view sees
// the list.
import { useMemo, type ReactNode } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { usePlan } from './PlanContext';
import { ITEM_TYPES, ITEM_TYPES_MAX } from '@livediagram/items';
import { Button, DuplicateIcon, PencilIcon, PlusIcon, Tooltip } from '@livediagram/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { DASHED_ADD_BUTTON } from './ItemTypeFieldForms';
import { ACCENT_BG, ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

export function CardTypesPanel({
  popoverOpen,
  popoverAnchor,
  onPopoverClose,
}: {
  popoverOpen: boolean;
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const confirm = useConfirm();
  const counts = useMemo(() => {
    const n = new Map<string, number>();
    for (const it of plan?.items.values() ?? []) n.set(it.type, (n.get(it.type) ?? 0) + 1);
    return n;
  }, [plan?.items]);
  if (!plan) return null;
  const { types, canEdit, itemTypes } = plan;
  const full = types.length >= ITEM_TYPES_MAX;
  // Built-in types (by id, edited or not) apart from the ones this document added (docs/specs/026-plan/item-types.md
  // "The Card Types panel").
  const builtIn = types.filter((t) => BUILT_IN_IDS.has(t.id));
  const own = types.filter((t) => !BUILT_IN_IDS.has(t.id));
  // One type's row: its edit (stretched over the row), Duplicate, and the pencil.
  const row = (t: (typeof types)[number]) => {
    const count = counts.get(t.id) ?? 0;
    const fields = t.fields.length;
    const label = `${count} ${count === 1 ? 'item' : 'items'}`;
    // The type's glyph, name, field count and item count: the row's face, in its edit button.
    // A type no card has yet is shown a little grey (its count is in its name for a screen reader, not on show).
    const face = (
      <span
        className={`flex min-w-0 flex-1 items-center gap-2.5 ${count === 0 ? 'opacity-55' : ''}`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
          style={accentVars(t.color)}
          aria-hidden
        >
          <PlanTypeGlyph glyph={t.glyph} size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col" aria-hidden>
          <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {t.label}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {fields} {fields === 1 ? 'field' : 'fields'}
            {t.custom?.length ? `, ${t.custom.length} custom` : ''}
          </span>
        </span>
      </span>
    );
    return (
      <li
        key={t.id}
        className={`group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-2 transition dark:border-slate-700 dark:bg-slate-900 ${
          canEdit
            ? 'hover:border-slate-300 hover:shadow-sm focus-within:ring-2 focus-within:ring-brand-400 dark:hover:border-slate-600'
            : ''
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1 ${ACCENT_BG}`}
          style={accentVars(t.color)}
          aria-hidden
        />
        {/* The row's edit and its duplicate are sibling buttons, never one inside the other: the edit
                    button stretches over the whole row (its ::after), and Duplicate sits above it. */}
        {canEdit ? (
          <button
            type="button"
            aria-label={`${t.label}, ${label}. Edit`}
            onClick={() => plan.editType(t.id)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {face}
          </button>
        ) : (
          <div
            className="flex min-w-0 flex-1 items-center gap-2.5"
            aria-label={`${t.label}, ${label}`}
          >
            {face}
          </div>
        )}
        {canEdit ? (
          <Tooltip
            label={
              full ? 'The document has the most card types it can hold' : `Duplicate ${t.label}`
            }
          >
            <button
              type="button"
              aria-label={
                full ? 'The document has the most card types it can hold' : `Duplicate ${t.label}`
              }
              aria-disabled={full || undefined}
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition ${
                full
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
              onClick={() => {
                if (!full) plan.editType('new', t.id);
              }}
            >
              <DuplicateIcon size={14} />
            </button>
          </Tooltip>
        ) : null}
        {canEdit ? (
          <span
            className="pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200"
            aria-hidden
          >
            <PencilIcon />
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <MovablePanel
      title="Card Types"
      helpArticle="planCardTypes"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-[34rem]"
      popoverWidth="w-[calc(100vw-2rem)] sm:w-[34rem]"
      onMoveTo={() => {}}
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        {/* Every built-in deleted: no heading over nothing; Restore built-in types brings them back. */}
        {builtIn.length > 0 ? (
          <TypeGroup title="Built-In Types">{builtIn.map(row)}</TypeGroup>
        ) : null}
        <TypeGroup
          title="Your Types"
          empty={canEdit ? 'Types you add show here.' : 'No types of your own yet.'}
        >
          {own.map(row)}
        </TypeGroup>
        {canEdit ? (
          <>
            <button
              type="button"
              className={DASHED_ADD_BUTTON}
              onClick={() => plan.editType('new')}
            >
              <PlusIcon />
              Add Type
            </button>
            {itemTypes.catalogue ? (
              <Button
                variant="ghost"
                size="xs"
                className="self-center px-2 py-0.5 text-[11px] font-normal"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Restore Built-In Types?',
                    message:
                      'Project, Task, Note, Idea and Action go back to how they started. Your own types stay as they are.',
                    confirmLabel: 'Restore',
                  });
                  if (ok) itemTypes.restoreBuiltIns();
                }}
              >
                Restore built-in types
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </MovablePanel>
  );
}

const BUILT_IN_IDS: ReadonlySet<string> = new Set(ITEM_TYPES.map((t) => t.id));

// A group of the panel's rows under a small heading, or its empty note.
function TypeGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: ReactNode[];
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children.length > 0 ? (
        <ul aria-label={title} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {children}
        </ul>
      ) : empty ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {empty}
        </p>
      ) : null}
    </section>
  );
}
