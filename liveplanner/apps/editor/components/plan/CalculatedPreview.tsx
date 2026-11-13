'use client';

// Preview (docs/specs/026-plan/item-types.md "Formula fields", "Rollup and Lookup fields", In the type editor): a
// Calculated field being written, worked out on a real card ("On #12 Website: £2,500"), its problem there, or why
// there is nothing to try it on. A Formula tries the type's first live card; a Rollup or Lookup the first live card
// it gives a value (other than 0) on, else the first.
import { useEffect, useMemo, useRef } from 'react';
import {
  calculatedText,
  isArchived,
  isTrashed,
  itemTitle,
  type CustomFieldDef,
  type FormulaOutcome,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { calculatedFieldOutcome, type CalculatedPlan } from './calculated-values';
import { usePlan } from './PlanContext';

type PreviewField = Pick<
  CustomFieldDef,
  'kind' | 'calculation' | 'formula' | 'result' | 'currency'
> &
  Partial<Pick<CustomFieldDef, 'id' | 'label' | 'through' | 'aggregate' | 'source'>>;

// The type's live cards, in number order.
function liveCards(items: ReadonlyMap<string, Item>, typeId: string): Item[] {
  const out: Item[] = [];
  for (const it of items.values())
    if (it.type === typeId && !isArchived(it) && !isTrashed(it)) out.push(it);
  return out.sort((a, b) => a.key - b.key);
}

// The card to try it on, and its outcome there.
function tried(
  plan: CalculatedPlan,
  typeId: string,
  def: PreviewField | null,
  type: ItemTypeDef,
  preferValue: boolean,
): { card: Item | undefined; outcome: FormulaOutcome | null } {
  const cards = liveCards(plan.items, typeId);
  const first = cards[0];
  if (!def || !first) return { card: first, outcome: null };
  if (preferValue)
    for (const card of cards) {
      const outcome = calculatedFieldOutcome(plan, def, card, type);
      // A count of 0 says little: the first card it counts something on.
      if (outcome.ok && outcome.value !== null && outcome.value !== 0) return { card, outcome };
    }
  return { card: first, outcome: calculatedFieldOutcome(plan, def, first, type) };
}

export function CalculatedPreview({
  typeId,
  typeLabel,
  type,
  field,
  waiting,
  preferValue = false,
}: {
  typeId: string | undefined;
  typeLabel: string | undefined;
  type: ItemTypeDef;
  // The field as it works now, or null while it doesn't (`waiting` says what for).
  field: PreviewField | null;
  waiting: string;
  preferValue?: boolean;
}) {
  const plan = usePlan();
  const { card, outcome } = useMemo(
    () =>
      plan && typeId
        ? tried(plan, typeId, field, type, preferValue)
        : { card: undefined, outcome: null },
    [plan, typeId, field, type, preferValue],
  );
  const text = outcome?.ok && field ? calculatedText(field, outcome.value) : null;
  // Kept in view while it is written: after each change to a formula or a menu above it in its form, the sheet
  // scrolls just enough that Preview sits clear of Add Field's sticky footer (its scroll margin). On a 320 px phone
  // the sheet's body is shorter than the formula, its problem and Preview together (Work Tracker 693). Not the name
  // field, nor on opening: the sheet opens at its top.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    let frame = 0;
    const onChange = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      if (!(el.compareDocumentPosition(ref.current!) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      cancelAnimationFrame(frame);
      // After the line above it has drawn this keystroke's problem.
      frame = requestAnimationFrame(() => ref.current?.scrollIntoView?.({ block: 'nearest' }));
    };
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener('input', onChange);
      form.removeEventListener('change', onChange);
    };
  }, []);
  return (
    <figure
      ref={ref}
      aria-label="Preview"
      className="flex scroll-mb-24 flex-col gap-1 rounded-xl bg-slate-100/80 p-2.5 dark:bg-slate-800/60"
    >
      <figcaption className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Preview
      </figcaption>
      <div className="@container rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {!card ? (
          <p className="text-slate-500 dark:text-slate-400">
            {typeLabel
              ? `No ${typeLabel} card to try it on yet`
              : 'No card of this type to try it on yet'}
          </p>
        ) : (
          // While it waits the row keeps one line, the title shortening: a two-line problem above it then still
          // leaves Preview over Add Field's footer on a phone (item-types.md "Formula fields"). Under 19rem (a 320 px
          // phone) the waiting words would cut the title to a sliver and lose their own end, so they take a second
          // line there instead.
          <p
            className={`flex min-w-0 items-baseline gap-x-2 gap-y-0.5 ${field ? 'flex-wrap' : '@max-[19rem]:flex-wrap'}`}
          >
            {/* The card's number always shows; its title gives way, keeping room for its ellipsis. */}
            <span className="flex min-w-0 items-baseline text-slate-600 dark:text-slate-300">
              <span className="shrink-0 whitespace-pre">
                On{' '}
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  #{card.key}
                </span>{' '}
              </span>
              <span className="min-w-[1.5em] truncate">{itemTitle(card) || 'Untitled'}</span>
            </span>
            {!field ? (
              <span className="min-w-0 shrink-0 truncate text-slate-500 @max-[19rem]:shrink dark:text-slate-400">
                {waiting}
              </span>
            ) : outcome && !outcome.ok ? (
              <span className="text-red-700 dark:text-red-300">{outcome.error}</span>
            ) : (
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {text ?? 'No value'}
              </span>
            )}
          </p>
        )}
      </div>
    </figure>
  );
}
