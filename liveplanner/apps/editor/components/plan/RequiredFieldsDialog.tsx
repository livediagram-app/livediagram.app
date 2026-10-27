'use client';

// New {Type} (docs/specs/026-plan/item-types.md "Required fields"): a card whose type requires fields it lacks asks
// for them before it is made: its title and each missing field, with the card panel's own controls. Create waits
// until every one has a value; Cancel (or the cross, or Escape) makes nothing.
import { useId, useState } from 'react';
import {
  ITEM_TITLE_MAX,
  isEmptyFieldValue,
  linkCandidates,
  linkTypesOf,
  type ItemFields,
  type ItemFieldValue,
} from '@liveplanner/items';
import { Button, CheckIcon, CloseIcon, TextInput } from '@liveplanner/ui';
import type { RequiredFieldsRequest } from '@/hooks/plan/useRequiredFieldsGate';
import { CustomFieldEditor } from './CustomFieldEditor';
import { LinkedCardField } from './LinkedCardField';
import { ItemDetailsRow } from './ItemPanelLayout';
import { PlanModal } from './PlanModal';
import { usePlan } from './PlanContext';

export function RequiredFieldsDialog({
  request,
  onDone,
}: {
  request: RequiredFieldsRequest;
  // The filled fields on Create; null on Cancel.
  onDone: (filled: ItemFields | null) => void;
}) {
  const plan = usePlan();
  const base = useId();
  const { type, missing } = request;
  const [title, setTitle] = useState(
    typeof request.fields['title'] === 'string' ? request.fields['title'] : type.newTitle,
  );
  const [values, setValues] = useState<Record<string, ItemFieldValue | undefined>>({});
  const set = (id: string, v: ItemFieldValue | undefined) =>
    setValues((was) => ({ ...was, [id]: v }));
  const empty = missing.filter((f) => isEmptyFieldValue(values[f.id]));
  const ready = title.trim().length > 0 && empty.length === 0;
  const create = () => {
    if (!ready) return;
    const filled: ItemFields = { ...request.fields, title: title.trim() };
    for (const f of missing) filled[f.id] = values[f.id]!;
    onDone(filled);
  };
  const items = plan?.items ?? new Map();
  return (
    <PlanModal
      label={`New ${type.label}`}
      onClose={() => onDone(null)}
      header={
        <h2 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
          New {type.label}
        </h2>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-300">
          {type.label} cards need {missing.length === 1 ? 'this field' : 'these fields'} before
          they’re made.
        </p>
        <ItemDetailsRow label="Title" htmlFor={`${base}-title`} required>
          <TextInput
            id={`${base}-title`}
            compact
            value={title}
            maxLength={ITEM_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </ItemDetailsRow>
        {missing.map((f) => {
          const id = `${base}-${f.id}`;
          const linkTypes = f.kind === 'card' ? linkTypesOf(f) : [];
          return (
            <ItemDetailsRow key={f.id} label={f.label} htmlFor={id} required>
              {linkTypes.length ? (
                <LinkedCardField
                  id={id}
                  label={f.label}
                  value={values[f.id]}
                  candidates={linkCandidates(items.values(), linkTypes, '')}
                  items={items}
                  types={plan?.types ?? [type]}
                  disabled={false}
                  onSave={(v) => set(f.id, v)}
                />
              ) : (
                <CustomFieldEditor
                  id={id}
                  field={f}
                  value={values[f.id]}
                  disabled={false}
                  onSave={(v) => {
                    set(f.id, v);
                    return true;
                  }}
                />
              )}
            </ItemDetailsRow>
          );
        })}
        <div className="mt-5 flex items-center justify-end gap-2">
          {!ready ? (
            <p className="mr-auto text-[12px] text-slate-500 dark:text-slate-400" role="note">
              {title.trim() ? `Fill in ${empty.map((f) => f.label).join(', ')}` : 'Add a title'}
            </p>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={() => onDone(null)}>
            <CloseIcon size={12} />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!ready}>
            <CheckIcon size={12} />
            Create
          </Button>
        </div>
      </form>
    </PlanModal>
  );
}
