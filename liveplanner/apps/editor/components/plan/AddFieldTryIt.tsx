'use client';

// Add Field's Try It (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): the field being shaped, drawn by
// the card panel's own editor (ItemFieldEditor) on a pretend card, so a Choice's list opens with the options typed, a
// Date's picker picks, a Phone box checks what is typed. What is tried stays here: it never reaches a card, the plan or
// the server, and it starts again when the kind or a setting that shapes it changes (its options, scale, currency...).
// The kinds that need a real card (Link to Card, Calculated, Image, Comments, Votes, Time Spent) keep the still
// preview, saying so.
import { useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import {
  PHONE_HINT,
  PULL_REQUEST_HINT,
  parsePullRequestUrl,
  isEmailAddress,
  isPhoneNumber,
  isTimeSpent,
  labelUsage,
  type CustomFieldDef,
  type CustomFieldKind,
  type Item,
  type ItemFieldValue,
  type ItemFields,
  type ItemPatch,
  type ItemPerson,
  type ItemTypeDef,
  type LabelUse,
} from '@liveplanner/items';
import type { NewField } from './AddFieldShape';
import { CustomFieldPreview } from './CustomFieldKindParts';
import { isLinkText } from './CustomFieldEditor';
import { ItemDetailsRow } from './ItemPanelLayout';
import {
  ItemFieldEditor,
  fieldId,
  labelsItsControl,
  type ItemFieldContext,
} from './ItemFieldEditor';
import { usePlan } from './PlanContext';

// The pretend card and its one field. One Try It is on screen at a time, so fixed ids are unique.
const TRY_ID = 'try-it';
const FIELD_ID = 'try-it-field';
const NOBODY: ItemPerson = { id: TRY_ID, name: '', color: '#64748b' };
const NO_PEOPLE: readonly ItemPerson[] = [];
const NO_LABELS: readonly LabelUse[] = [];
const NO_STATUSES: readonly { status: string; name: string }[] = [];

// The kinds that need a real card: a linked card, a worked-out value, an upload, threads, votes, a timer.
const STILL: ReadonlySet<CustomFieldKind> = new Set([
  'card',
  'calculated',
  'image',
  'comments',
  'votes',
]);
export const STILL_NOTE = 'Shows on a real card';

// What a typed box refuses, said as the agent tools say it: the panel puts the box back, and Try It says why.
const CHECKS: Partial<Record<CustomFieldKind, { ok: (text: string) => boolean; hint: string }>> = {
  phone: { ok: isPhoneNumber, hint: PHONE_HINT },
  email: { ok: isEmailAddress, hint: 'Write an email address like sam@example.com' },
  link: { ok: isLinkText, hint: 'Write a link that starts https://' },
  pullrequest: { ok: (t) => parsePullRequestUrl(t) !== undefined, hint: PULL_REQUEST_HINT },
};

// What starts the try again: everything that shapes the value, never the name, Required or Notifies.
const shapeKey = (field: NewField): string =>
  JSON.stringify(field, (k, v: unknown) =>
    k === 'label' || k === 'required' || k === 'notifies' ? undefined : v,
  );

export function AddFieldTryIt({
  field,
  linkLabel,
  required,
}: {
  field: NewField;
  // The linked types' names, for a Link to Card field's still preview.
  linkLabel?: string | undefined;
  // Drawn with the required mark.
  required: boolean;
}) {
  const label = field.label.trim() || 'Field name';
  const def: CustomFieldDef = { ...field, id: FIELD_ID, label };
  if (STILL.has(field.kind) || isTimeSpent(def))
    return (
      <CustomFieldPreview
        label={field.label}
        kind={field.kind}
        options={field.options ?? []}
        linkLabel={linkLabel}
        currency={field.currency}
        scale={field.scale}
        calculation={field.calculation}
        showAs={field.showAs}
        timeSpent={field.timeSpent}
        withTime={field.withTime}
        multiple={field.multiple}
        blocks={field.blocks}
        required={required}
        note={STILL_NOTE}
      />
    );
  return (
    <figure
      aria-label="Try It"
      className="flex flex-col gap-1.5 rounded-xl bg-slate-100/80 p-2.5 dark:bg-slate-800/60"
    >
      <figcaption className="flex items-baseline justify-between gap-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Try It
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Nothing here is saved
        </span>
      </figcaption>
      <Sandbox key={shapeKey(field)} def={def} required={required} />
    </figure>
  );
}

// The pretend card: its value held here alone, every save and patch landing in it.
function Sandbox({ def, required }: { def: CustomFieldDef; required: boolean }) {
  const [fields, setFields] = useState<ItemFields>({});
  const [problem, setProblem] = useState<string | null>(null);
  const plan = usePlan();
  const items = plan?.items;
  // The plan's labels to pick from (read only), worked out once per change of its cards and only for Labels.
  const labels = useMemo(
    () => (def.kind === 'labels' && items ? labelUsage(items.values()) : NO_LABELS),
    [def.kind, items],
  );
  const type: ItemTypeDef = {
    id: TRY_ID,
    label: 'Example card',
    newTitle: '',
    glyph: 'item',
    color: NOBODY.color,
    fields: [FIELD_ID],
    custom: [def],
  };
  const item: Item = {
    id: TRY_ID,
    type: TRY_ID,
    key: 0,
    rank: '',
    fields,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    createdBy: NOBODY,
    updatedBy: NOBODY,
  };
  const ctx: ItemFieldContext = {
    item,
    type,
    statuses: NO_STATUSES,
    people: plan?.people ?? NO_PEOPLE,
    canEdit: true,
    labels,
    onSave: (f, value) => {
      setFields((prev) => withValue(prev, f, value));
      return Promise.resolve(true);
    },
    onPatch: (patch) => setFields((prev) => patched(prev, patch)),
    onOpenItem: () => {},
  };
  const id = fieldId(item, FIELD_ID);
  const check = CHECKS[def.kind];

  // Enter in a box tries the value, never adds the field (the Shape step is a form, and Enter submits it).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
  };
  // Before the box's own blur puts back what it refuses, read what was typed and say why.
  const onBlurCapture = (e: FocusEvent<HTMLDivElement>) => {
    if (!check || !(e.target instanceof HTMLInputElement) || e.target.id !== id) return;
    const raw = e.target.value.trim();
    setProblem(raw === '' || check.ok(raw) ? null : `${def.label}: ${check.hint}.`);
  };

  return (
    // The keys and blur are the field's own, caught on the way up; nothing here is a control.
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 pb-1.5 pt-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      onKeyDown={onKeyDown}
      onBlurCapture={onBlurCapture}
    >
      <p className="mb-1 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
        Example card
      </p>
      <ItemDetailsRow
        label={def.label}
        htmlFor={labelsItsControl(type, FIELD_ID) ? id : undefined}
        required={required}
      >
        <ItemFieldEditor f={FIELD_ID} ctx={ctx} />
        {problem ? (
          <p role="alert" className="mt-1 text-[12px] text-red-700 dark:text-red-300">
            {problem}
          </p>
        ) : null}
      </ItemDetailsRow>
    </div>
  );
}

function withValue(fields: ItemFields, f: string, value: ItemFieldValue | undefined): ItemFields {
  const next = { ...fields };
  if (value === undefined) delete next[f];
  else next[f] = value;
  return next;
}

function patched(fields: ItemFields, patch: ItemPatch): ItemFields {
  const next = { ...fields, ...patch.set };
  for (const f of patch.clear ?? []) delete next[f];
  return next;
}
