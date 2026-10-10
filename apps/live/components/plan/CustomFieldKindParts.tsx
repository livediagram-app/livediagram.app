'use client';

// New Custom Field's kind and preview (docs/specs/026-plan/item-types.md "Editing a type": Add Field): the eight
// kinds as a grid of icon tiles, one radio group, and a preview of the field as the card's panel will show it,
// named as typed, with a sample value of its kind.
import type { CustomFieldDef, CustomFieldKind } from '@livediagram/items';
import { CheckIcon, lucideGlyph } from '@livediagram/ui';
import { lucideHash, lucideList, lucideLink, lucideType } from '@livediagram/icons/lucide';
import { CUSTOM_KIND_LABELS } from './ItemTypeFieldForms';
import { ItemDetailsRow } from './ItemPanelLayout';
import { PlanTypeGlyph } from './plan-type-glyph';

const TypeIcon = lucideGlyph(lucideType, 16);
const HashIcon = lucideGlyph(lucideHash, 16);
const ListIcon = lucideGlyph(lucideList, 16);
const LinkIcon = lucideGlyph(lucideLink, 16);

// Each kind's icon: what its value looks like.
export const CUSTOM_KIND_ICONS: Record<CustomFieldKind, React.ReactNode> = {
  text: <TypeIcon />,
  longtext: <PlanTypeGlyph glyph="document" size={16} />,
  number: <HashIcon />,
  date: <PlanTypeGlyph glyph="calendar" size={16} />,
  checkbox: <PlanTypeGlyph glyph="task" size={16} />,
  link: <LinkIcon />,
  choice: <ListIcon />,
  card: <PlanTypeGlyph glyph="ticket" size={16} />,
};

// What a built-in field holds, as the custom kind closest to it, so every row of the type editor wears the Add
// Field popover's icons. The Assignee is a person, which no custom kind is (people are assigned there).
const BUILT_IN_KINDS: Partial<Record<string, CustomFieldKind>> = {
  title: 'text',
  description: 'longtext',
  status: 'choice',
  priority: 'choice',
  color: 'choice',
  labels: 'choice',
  estimate: 'number',
  start: 'date',
  due: 'date',
  checklist: 'checkbox',
  comments: 'longtext',
  votes: 'number',
};

// A field's icon and the name of what it holds ("Link to Card", "Date", "Person"), for the type editor's rows.
export function fieldIconOf(
  id: string,
  custom: Pick<CustomFieldDef, 'kind'> | undefined,
): { node: React.ReactNode; name: string } {
  if (!custom && id === 'assignee')
    return { node: <PlanTypeGlyph glyph="person" size={16} />, name: 'Person' };
  const kind = custom?.kind ?? BUILT_IN_KINDS[id] ?? 'text';
  return { node: CUSTOM_KIND_ICONS[kind], name: CUSTOM_KIND_LABELS[kind] };
}

export function CustomFieldKindTiles({
  kinds,
  value,
  onChange,
}: {
  kinds: readonly CustomFieldKind[];
  value: CustomFieldKind;
  onChange: (kind: CustomFieldKind) => void;
}) {
  return (
    <div role="radiogroup" aria-label="New field's kind" className="grid grid-cols-4 gap-1">
      {kinds.map((k) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition ${
              on
                ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-100'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
            }`}
            onClick={() => onChange(k)}
          >
            {CUSTOM_KIND_ICONS[k]}
            {CUSTOM_KIND_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

// A sample of each kind, drawn as the card's panel draws a value (quietly: it is only a picture).
function SampleValue({
  kind,
  options,
  linkLabel,
}: {
  kind: CustomFieldKind;
  options: readonly string[];
  linkLabel: string | undefined;
}) {
  const box =
    'rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  switch (kind) {
    case 'text':
      return <div className={box}>Some text</div>;
    case 'longtext':
      return (
        <div className={`${box} leading-snug`}>
          A few lines of notes, as long as they need to be.
        </div>
      );
    case 'number':
      return <div className={`${box} w-20 tabular-nums`}>42</div>;
    case 'date':
      return (
        <div className={`${box} inline-flex items-center gap-1.5`}>
          <PlanTypeGlyph glyph="calendar" size={13} />
          12 Oct 2026
        </div>
      );
    case 'checkbox':
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded border border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600">
          <CheckIcon size={11} />
        </span>
      );
    case 'link':
      return <span className="text-brand-700 underline dark:text-brand-300">example.com</span>;
    case 'choice':
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {options[0] ?? 'An option'}
        </span>
      );
    case 'card':
      return (
        <div className={`${box} inline-flex items-center gap-1.5`}>
          <PlanTypeGlyph glyph="ticket" size={13} />
          {linkLabel ? `A ${linkLabel} card` : 'A linked card'}
        </div>
      );
  }
}

export function CustomFieldPreview({
  label,
  kind,
  options,
  linkLabel,
}: {
  label: string;
  kind: CustomFieldKind;
  options: readonly string[];
  // The linked type's name, for a Link to Card field.
  linkLabel?: string | undefined;
}) {
  return (
    <figure
      aria-label="Preview"
      className="rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50"
    >
      <figcaption className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
        Preview
      </figcaption>
      <div className="pointer-events-none" aria-hidden>
        <ItemDetailsRow label={label.trim() || 'Field name'}>
          <SampleValue kind={kind} options={options} linkLabel={linkLabel} />
        </ItemDetailsRow>
      </div>
    </figure>
  );
}
