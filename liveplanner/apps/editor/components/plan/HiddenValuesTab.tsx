'use client';

// The item panel's Hidden tab (docs/specs/026-plan/item-types.md "The Hidden tab"): the values the card keeps in
// fields its type doesn't show, grouped by the type they came from (From Idea), each drawn read-only by its kind as a
// card of that type draws it; a removed field's value as plain text. An Editor copies one into a field of the card's
// own type (Copy To Field, the type-change rules) or removes it, each one write and one undo step; a Participant and
// a Viewer read it.
import { useState } from 'react';
import {
  hiddenCopyPatch,
  hiddenCopyTargets,
  hiddenRemovePatch,
  hiddenValueText,
  type CustomFieldDef,
  type HiddenGroup,
  type HiddenValue,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Button, DuplicateIcon, TrashIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideEyeOff } from '@liveworkspace/icons/lucide';
import {
  MenuActionRow,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { track } from '@/lib/telemetry';
import { ItemFieldEditor, fieldLabel, type ItemFieldContext } from './ItemFieldEditor';
import { PlanTypeGlyph } from './plan-type-glyph';

const EyeOffIcon = lucideGlyph(lucideEyeOff, 16);

export function HiddenValuesTab({
  groups,
  ctx,
  canChange,
}: {
  groups: readonly HiddenGroup[];
  // The open card's own field context (its type, its writes); each value is drawn with its source type's.
  ctx: ItemFieldContext;
  // Copy To Field and Remove: an Editor's.
  canChange: boolean;
}) {
  return (
    <div data-hidden-values-tab="">
      <p className="mb-5 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-snug text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <EyeOffIcon aria-hidden className="mt-px shrink-0 text-slate-500 dark:text-slate-400" />
        <span>Values this card keeps from fields its {ctx.type.label} type doesn’t show.</span>
      </p>
      {groups.map((g) => (
        <HiddenGroupSection key={g.type?.id ?? ''} group={g} ctx={ctx} canChange={canChange} />
      ))}
    </div>
  );
}

function HiddenGroupSection({
  group,
  ctx,
  canChange,
}: {
  group: HiddenGroup;
  ctx: ItemFieldContext;
  canChange: boolean;
}) {
  const headingId = `item-${ctx.item.id}-hidden-${group.type?.id ?? 'removed'}`;
  return (
    <section aria-labelledby={headingId} className="mb-7">
      <h3
        id={headingId}
        className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {group.type ? (
          <>
            <PlanTypeGlyph glyph={group.type.glyph} size={14} color={group.type.color} />
            From {group.type.label}
          </>
        ) : (
          'Removed Fields'
        )}
      </h3>
      <ul className="flex flex-col gap-3">
        {group.values.map((v) => (
          <HiddenValueRow
            key={v.field}
            value={v}
            source={group.type}
            ctx={ctx}
            canChange={canChange}
          />
        ))}
      </ul>
    </section>
  );
}

function HiddenValueRow({
  value,
  source,
  ctx,
  canChange,
}: {
  value: HiddenValue;
  source: ItemTypeDef | null;
  ctx: ItemFieldContext;
  canChange: boolean;
}) {
  const label = source && value.def ? fieldLabel(source, value.field) : 'Removed Field';
  const labelId = `item-${ctx.item.id}-hidden-${value.field}-label`;
  const remove = () => {
    track('Plan', 'Removed', 'HiddenValue');
    ctx.onPatch(hiddenRemovePatch(ctx.item, value.field));
  };
  return (
    <li
      aria-labelledby={labelId}
      data-hidden-value={value.field}
      className="rounded-xl border border-slate-200 px-3.5 pb-3 pt-2 dark:border-slate-700"
    >
      <div className="mb-1.5 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          id={labelId}
          className="min-w-0 flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
        >
          {label}
        </span>
        {canChange ? (
          <span className="flex shrink-0 items-center gap-1">
            {value.def ? (
              <CopyToField value={value} def={value.def} label={label} ctx={ctx} />
            ) : null}
            <Tooltip label="Remove">
              <Button
                variant="ghost"
                size="xs"
                className="size-8 px-0 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                aria-label={`Remove ${label}`}
                onClick={remove}
              >
                <TrashIcon size={15} aria-hidden />
              </Button>
            </Tooltip>
          </span>
        ) : null}
      </div>
      {source && value.def ? (
        <ItemFieldEditor f={value.field} ctx={{ ...ctx, type: source, canEdit: false }} />
      ) : (
        <p className="whitespace-pre-wrap break-words text-[13px] text-slate-700 dark:text-slate-200">
          {hiddenValueText(value.value)}
        </p>
      )}
    </li>
  );
}

// Copy To Field: a menu of the card's own fields that can take the value; disabled, saying why, with none.
function CopyToField({
  value,
  def,
  label,
  ctx,
}: {
  value: HiddenValue;
  def: CustomFieldDef;
  label: string;
  ctx: ItemFieldContext;
}) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const targets = hiddenCopyTargets(ctx.type, def, value.value);
  const none = targets.length === 0;
  const copy = (target: CustomFieldDef) => {
    setOpen(false);
    track('Plan', 'Copied', 'HiddenValue');
    ctx.onPatch(hiddenCopyPatch(ctx.item, def, target));
  };
  const trigger = (
    <Button
      ref={setButton}
      variant="secondary"
      size="xs"
      className="gap-1.5"
      aria-label={`Copy ${label} to a field`}
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={none}
      onClick={() => setOpen((v) => !v)}
    >
      <DuplicateIcon size={14} aria-hidden />
      Copy To Field
    </Button>
  );
  return (
    <>
      {none ? (
        <Tooltip label={`No field on ${ctx.type.label} can take this value.`}>
          <span>{trigger}</span>
        </Tooltip>
      ) : (
        trigger
      )}
      {open ? (
        <PortalMenu
          anchor={button}
          placement="below"
          label={`Copy ${label} to`}
          onClose={() => setOpen(false)}
        >
          <MenuHeader title={`Copy ${label} To`} />
          {targets.map((t) => {
            const holds = ctx.item.fields[t.id] !== undefined && ctx.item.fields[t.id] !== '';
            return (
              <MenuActionRow
                key={t.id}
                label={holds ? `${t.label} (replaces its value)` : t.label}
                icon={<DuplicateIcon size={14} aria-hidden />}
                onClick={() => copy(t)}
              />
            );
          })}
        </PortalMenu>
      ) : null}
    </>
  );
}
