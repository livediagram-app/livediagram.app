'use client';

// Each custom field kind's icon, and Add Field's preview (docs/specs/026-plan/item-types.md "Fields and Tabs": Add
// Field): a small card holding the field as the card's panel will show it, named as typed, with a sample value of its
// kind.
import {
  RATING_FIELD_SCALE_DEFAULT,
  currencyText,
  ratingText,
  canShowAsPercent,
  type CustomFieldDef,
  type Calculation,
  type CustomFieldKind,
} from '@liveplanner/items';
import { CheckIcon, lucideGlyph } from '@liveplanner/ui';
import {
  lucideCalculator,
  lucideClipboardCheck,
  lucideHash,
  lucideImage,
  lucideList,
  lucideListChecks,
  lucideLink,
  lucideMessageSquare,
  lucidePalette,
  lucideTag,
  lucideType,
  lucideVote,
} from '@liveworkspace/icons/lucide';
import type { PickKind } from './add-field-kinds';
import { PICK_KIND_LABELS } from './ItemTypeFieldForms';
import { ItemDetailsRow } from './ItemPanelLayout';
import { PlanTypeGlyph } from './plan-type-glyph';
import { PersonDisc } from './PersonDisc';
import { PlayIcon } from './time/TimerReadouts';
import { LabelChips } from './plan-card-parts';
import { planColourName } from './ColourSwatches';
import { PercentReading } from './PercentBar';

const TypeIcon = lucideGlyph(lucideType, 16);
const HashIcon = lucideGlyph(lucideHash, 16);
const ListIcon = lucideGlyph(lucideList, 16);
const LinkIcon = lucideGlyph(lucideLink, 16);
const ListChecksIcon = lucideGlyph(lucideListChecks, 16);
const CalculatorIcon = lucideGlyph(lucideCalculator, 16);
const TagIcon = lucideGlyph(lucideTag, 16);
const PaletteIcon = lucideGlyph(lucidePalette, 16);
const ChecklistIcon = lucideGlyph(lucideClipboardCheck, 16);
const ImageIcon = lucideGlyph(lucideImage, 16);
const CommentsIcon = lucideGlyph(lucideMessageSquare, 16);
const VotesIcon = lucideGlyph(lucideVote, 16);

// Each kind's icon: what its value looks like.
export const CUSTOM_KIND_ICONS: Record<CustomFieldKind, React.ReactNode> = {
  text: <TypeIcon />,
  longtext: <PlanTypeGlyph glyph="project" size={16} />,
  number: <HashIcon />,
  currency: <PlanTypeGlyph glyph="coin" size={16} />,
  percent: <PlanTypeGlyph glyph="percent" size={16} />,
  duration: <PlanTypeGlyph glyph="clock" size={16} />,
  date: <PlanTypeGlyph glyph="calendar" size={16} />,
  checkbox: <PlanTypeGlyph glyph="task" size={16} />,
  link: <LinkIcon />,
  email: <PlanTypeGlyph glyph="mail" size={16} />,
  choice: <ListIcon />,
  multichoice: <ListChecksIcon />,
  rating: <PlanTypeGlyph glyph="star" size={16} />,
  card: <PlanTypeGlyph glyph="ticket" size={16} />,
  calculated: <CalculatorIcon />,
  person: <PlanTypeGlyph glyph="person" size={16} />,
  labels: <TagIcon />,
  colour: <PaletteIcon />,
  checklist: <ChecklistIcon />,
  image: <ImageIcon />,
  comments: <CommentsIcon />,
  votes: <VotesIcon />,
};

// Add Field's kinds: every custom kind's icon, and the one-to-a-type built-in fields' (Comments, Votes).
export const PICK_KIND_ICONS: Record<PickKind, React.ReactNode> = {
  ...CUSTOM_KIND_ICONS,
  comments: <CommentsIcon />,
  votes: <VotesIcon />,
};

// What a built-in field holds, as its kind (docs/specs/026-plan/item-types.md "Fields and Tabs"), so every row of the
// type editor wears the Add Field popover's icons: the Assignee a Person, Labels Labels, Comments and Votes their own.
const BUILT_IN_KINDS: Partial<Record<string, PickKind>> = {
  title: 'text',
  description: 'longtext',
  status: 'choice',
  priority: 'choice',
  assignee: 'person',
  color: 'colour',
  labels: 'labels',
  estimate: 'number',
  start: 'date',
  due: 'date',
  checklist: 'checklist',
  comments: 'comments',
  votes: 'votes',
  attachments: 'image',
};

// A field's icon and the name of what it holds ("Link to Card", "Date", "Person"), for the type editor's rows.
export function fieldIconOf(
  id: string,
  custom: Pick<CustomFieldDef, 'kind'> | undefined,
): { node: React.ReactNode; name: string } {
  const kind = custom?.kind ?? BUILT_IN_KINDS[id] ?? 'text';
  return { node: PICK_KIND_ICONS[kind], name: PICK_KIND_LABELS[kind] };
}

const SAMPLE_PERSON = { id: 'sample', name: 'Sam Rivera', color: '#7c3aed' };
const SAMPLE_COLOUR = '#0d9488';
const SAMPLE_PERCENT = 40;

// A sample of each kind, drawn as the card's panel draws a value (quietly: it is only a picture).
function SampleValue({
  kind,
  options,
  linkLabel,
  currency,
  scale,
  calculation,
  showAs,
  timeSpent,
}: {
  kind: CustomFieldKind;
  options: readonly string[];
  linkLabel: string | undefined;
  currency: string | undefined;
  scale: number | undefined;
  calculation: Calculation | undefined;
  showAs: 'percent' | undefined;
  timeSpent?: boolean | undefined;
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
    case 'currency':
      return <div className={`${box} w-28 tabular-nums`}>{currencyText(12500, currency)}</div>;
    // The panel's bar at a sample share (docs/specs/026-plan/item-types.md "Percent").
    case 'percent':
      return <PercentReading value={SAMPLE_PERCENT} />;
    // "2h 30m"; tracking time, the total and the timer's Start beside it (docs/specs/026-plan/item-types.md "Duration").
    case 'duration':
      return timeSpent ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            2h 30m
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2 py-0.5 text-[12px] font-medium text-white dark:bg-brand-600">
            <PlayIcon />
            <span className="text-optical-centre">Start</span>
          </span>
        </span>
      ) : (
        <div className={`${box} w-24 tabular-nums`}>2h 30m</div>
      );
    case 'email':
      return <span className="text-brand-700 underline dark:text-brand-300">sam@example.com</span>;
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
    case 'multichoice':
      return (
        <span className="flex flex-wrap gap-1">
          {(options.length ? options.slice(0, 2) : ['An option', 'Another']).map((o) => (
            <span
              key={o}
              className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {o}
            </span>
          ))}
        </span>
      );
    case 'rating':
      return (
        <span className="text-[14px] tracking-wider text-amber-500" aria-hidden>
          {ratingText(4, scale ?? RATING_FIELD_SCALE_DEFAULT)}
        </span>
      );
    case 'card':
      return (
        <div className={`${box} inline-flex items-center gap-1.5`}>
          <PlanTypeGlyph glyph="ticket" size={13} />
          {linkLabel ? `A ${linkLabel} card` : 'A linked card'}
        </div>
      );
    case 'calculated':
      // A Calculated field's value, worked out and read-only (docs/specs/026-plan/item-types.md "Calculated fields"):
      // the Percent bar when a share is shown as one.
      if (showAs === 'percent' && canShowAsPercent({ kind, calculation }))
        return <PercentReading value={SAMPLE_PERCENT} />;
      return (
        <span className="text-[13px] tabular-nums text-slate-700 dark:text-slate-200">
          {calculation === 'childrenDone' ? '40%' : '3'}
        </span>
      );
    // The built-in fields' kinds, as their fields draw (docs/specs/026-plan/item-types.md "Custom field kinds").
    case 'person':
      return (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
          <PersonDisc person={SAMPLE_PERSON} />
          {SAMPLE_PERSON.name}
        </span>
      );
    case 'labels':
      return <LabelChips labels={['Design', 'Urgent']} />;
    case 'colour':
      return (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SAMPLE_COLOUR }} />
          {planColourName(SAMPLE_COLOUR)}
        </span>
      );
    case 'checklist':
      return (
        <span className="inline-flex items-center gap-1 text-[13px] tabular-nums text-slate-700 dark:text-slate-200 [&_svg]:h-3.5 [&_svg]:w-3.5">
          <ChecklistIcon />
          2/5
        </span>
      );
    case 'image':
      return (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
          <span className="flex h-7 w-10 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <ImageIcon />
          </span>
          photo.png
        </span>
      );
    // A Comments field reads as the count of its open threads' comments, as the card's chip draws it
    // (item-types.md "Comments and Votes fields").
    case 'comments':
      return (
        <span className="inline-flex items-center gap-1 text-[13px] tabular-nums text-slate-700 dark:text-slate-200 [&_svg]:h-3.5 [&_svg]:w-3.5">
          <CommentsIcon />2
        </span>
      );
    // A Votes field reads as the built-in Votes' ▲ count.
    case 'votes':
      return (
        <span className="text-[13px] tabular-nums text-slate-700 dark:text-slate-200">▲ 3</span>
      );
  }
}

export function CustomFieldPreview({
  label,
  kind,
  options,
  linkLabel,
  currency,
  scale,
  calculation,
  showAs,
  timeSpent,
  required,
}: {
  label: string;
  kind: CustomFieldKind;
  options: readonly string[];
  // The linked type's name, for a Link to Card field.
  linkLabel?: string | undefined;
  // A Currency field's code.
  currency?: string | undefined;
  // A Rating field's scale.
  scale?: number | undefined;
  // A Calculated field's calculation.
  calculation?: Calculation | undefined;
  // A share drawn as a Percent field is.
  showAs?: 'percent' | undefined;
  // A Duration field that tracks time.
  timeSpent?: boolean | undefined;
  // Drawn with the required mark.
  required?: boolean | undefined;
}) {
  return (
    <figure
      aria-label="Preview"
      className="flex flex-col gap-1.5 rounded-xl bg-slate-100/80 p-2.5 dark:bg-slate-800/60"
    >
      <figcaption className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Preview
      </figcaption>
      {/* A card as a board's panel draws it: only a picture, so nothing in it takes a press or focus. */}
      <div
        className="pointer-events-none rounded-lg border border-slate-200 bg-white px-3 pb-1.5 pt-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        aria-hidden
      >
        <p className="mb-1 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          Example card
        </p>
        <ItemDetailsRow label={label.trim() || 'Field name'} required={required === true}>
          <SampleValue
            kind={kind}
            options={options}
            linkLabel={linkLabel}
            currency={currency}
            scale={scale}
            calculation={calculation}
            showAs={showAs}
            timeSpent={timeSpent}
          />
        </ItemDetailsRow>
      </div>
    </figure>
  );
}
