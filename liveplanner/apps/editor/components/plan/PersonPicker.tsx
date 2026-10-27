'use client';

// The card panel's Assignee picker (docs/specs/026-plan/items.md "Who may do what"): No one, the plan's people,
// then + Custom Assignee, which opens a small popover to name someone outside your teams and assigns the card to
// them at once. Offered only to someone who may edit the card (an Editor or a Participant); a Viewer's picker is
// disabled and has no custom row.
import { Button, Select, TextInput } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { useRef, useState, type FormEvent } from 'react';
import {
  CUSTOM_ASSIGNEE_NAME_MAX,
  isItemPerson,
  personNamed,
  type ItemFieldValue,
  type ItemPerson,
} from '@liveplanner/items';
import { track } from '@/lib/telemetry';

// The select's value for the custom row: never a person id (those are hashes or `n-` slugs).
export const CUSTOM_ASSIGNEE_OPTION = '__custom__';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

export function PersonPicker({
  id,
  value,
  people,
  disabled,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  people: readonly ItemPerson[];
  disabled: boolean;
  onSave: Save;
}) {
  const select = useRef<HTMLSelectElement>(null);
  const [naming, setNaming] = useState(false);
  const current = isItemPerson(value) ? value : null;
  const options =
    current && !people.some((p) => p.id === current.id) ? [current, ...people] : people;
  return (
    <>
      <Select
        ref={select}
        id={id}
        className="w-full"
        selectClassName="text-[13px]"
        disabled={disabled}
        value={current?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === CUSTOM_ASSIGNEE_OPTION) {
            // The select keeps showing who it is on until a name is added.
            e.target.value = current?.id ?? '';
            setNaming(true);
            return;
          }
          const p = options.find((o) => o.id === e.target.value);
          void onSave(p ? { ...p } : undefined);
        }}
      >
        <option value="">No one</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {disabled ? null : <option value={CUSTOM_ASSIGNEE_OPTION}>+ Custom Assignee</option>}
      </Select>
      {naming && select.current ? (
        <CustomAssigneePopover
          anchor={select.current}
          onClose={() => setNaming(false)}
          onAdd={(name) => {
            setNaming(false);
            track('Plan', 'Added', 'CustomAssignee');
            void onSave({ ...personNamed(name, options) });
          }}
        />
      ) : null}
    </>
  );
}

// Custom Assignee: a name, then Add. Enter adds; Escape, Cancel or a press outside close it unsaved.
export function CustomAssigneePopover({
  anchor,
  onClose,
  onAdd,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    onAdd(trimmed);
    anchor.focus();
  };
  return (
    <AnchoredPopover anchor={anchor} name="Custom Assignee" width={260} onClose={onClose}>
      <form
        onSubmit={submit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Custom Assignee
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Someone outside your team. Anyone on this plan can then pick them.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Name
          </span>
          <TextInput
            compact
            value={name}
            maxLength={CUSTOM_ASSIGNEE_NAME_MAX}
            placeholder="Their name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => {
              onClose();
              anchor.focus();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="xs" disabled={!trimmed}>
            Add
          </Button>
        </div>
      </form>
    </AnchoredPopover>
  );
}
