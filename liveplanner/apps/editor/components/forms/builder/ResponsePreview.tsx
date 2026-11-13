'use client';

// What a Response Makes (docs/specs/030-forms/forms.md "Responses Go To and Settings"): under Responses Go To's
// sentence, the card one response makes, drawn as the board draws it (its own card face, palette, fields and size),
// filled with a sample answer to each question; under it, where each answer lands (Title, a field, or Description,
// as the real card writes it). A Sheet shows the row it adds instead. Hovering a line marks the question that fills
// it in the builder, and hovering a question marks its line. Built by response-preview.ts on the api's own code.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CardTypeRule, FormDefinition } from '@liveplanner/forms';
import {
  CARD_FIELDS,
  readCardSize,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import type { Element as PlanElement } from '@liveplanner/project';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PlanCardFace } from '@/components/plan/PlanCardFace';
import { planOwnColours, planPalette } from '@/components/plan/plan-palette';
import { ChoiceChip } from './ChoiceChip';
import { previewCard, previewSheetRow } from './response-preview';

// The outline a hovered line puts on the question that fills it: inline, over the card's own outline-none.
const MARK = { outline: '2px solid var(--color-brand-400, #a78bfa)', outlineOffset: '3px' };

// The question under the pointer in the builder, and the one a hovered line marks there.
function useQuestionHover(marked: string | null): string | null {
  const [over, setOver] = useState<string | null>(null);
  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest('[data-form-question]') : null;
      setOver(el?.getAttribute('data-form-question') ?? null);
    };
    document.addEventListener('pointerover', onOver, { passive: true });
    return () => document.removeEventListener('pointerover', onOver);
  }, []);
  useEffect(() => {
    if (!marked) return;
    const els = document.querySelectorAll(`[data-form-question="${CSS.escape(marked)}"]`);
    els.forEach((el) => Object.assign((el as HTMLElement).style, MARK));
    return () =>
      els.forEach((el) =>
        Object.assign((el as HTMLElement).style, { outline: '', outlineOffset: '' }),
      );
  }, [marked]);
  return over;
}

// Open at first: the preview is the point (a section of the panel, as Set Automatically is).
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
      <AccordionSection title={title} open={open} onToggle={() => setOpen((o) => !o)}>
        {children}
      </AccordionSection>
    </div>
  );
}

// A line's row: its label and value, marked while it or its question is under the pointer.
function Line({
  label,
  value,
  on,
  linked,
  onHover,
}: {
  label: ReactNode;
  value: ReactNode;
  on: boolean;
  linked: boolean;
  onHover: (on: boolean) => void;
}) {
  return (
    <li
      onPointerEnter={linked ? () => onHover(true) : undefined}
      onPointerLeave={linked ? () => onHover(false) : undefined}
      className={`flex min-w-0 gap-2 rounded-md px-2 py-1 text-[12px] leading-snug transition-colors ${
        on
          ? 'bg-brand-100 text-brand-900 dark:bg-brand-500/25 dark:text-brand-50'
          : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      <span className="w-[38%] shrink-0 truncate font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </li>
  );
}

export function CardResponsePreview({
  form,
  type,
  board,
  element,
  rules = [],
}: {
  form: FormDefinition;
  type: ItemTypeDef;
  board: PlanBoardSetup;
  element: PlanElement;
  // The card type rules that hold, each with its type (forms.md "Choosing the card type by an answer"): chips over
  // the card switch the preview to each rule's card. None: the default type's card alone, no chips.
  rules?: readonly { rule: CardTypeRule; type: ItemTypeDef }[];
}) {
  const [ruleId, setRuleId] = useState<string | null>(null);
  const picked = rules.find((r) => r.rule.id === ruleId);
  const shownType = picked?.type ?? type;
  // Recomputed on a form, type or chip change alone (O(questions)); the dates read today's.
  const preview = useMemo(
    () => previewCard(form, 'form', shownType, undefined, picked?.rule),
    [form, shownType, picked?.rule],
  );
  const surface = useCanvasSurface();
  const palette = useMemo(
    () => planPalette(surface, element.type === 'shape' ? planOwnColours(element) : {}),
    [surface, element],
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const over = useQuestionHover(hovered);
  const lit = hovered ?? over;
  const hover = (id: string | undefined) => (on: boolean) => setHovered(on && id ? id : null);
  return (
    <Disclosure title="What a Response Makes">
      {rules.length ? (
        <div role="radiogroup" aria-label="Preview card type" className="flex flex-wrap gap-1.5">
          {[
            { id: null, label: type.label },
            ...rules.map((r) => ({ id: r.rule.id, label: r.type.label })),
          ].map((c) => {
            const on = (picked?.rule.id ?? null) === c.id;
            return (
              <ChoiceChip
                key={c.id ?? 'default'}
                radio
                small
                on={on}
                onClick={() => setRuleId(c.id)}
              >
                <span className="text-optical-centre">{c.label}</span>
              </ChoiceChip>
            );
          })}
        </div>
      ) : null}
      <div className="rounded-xl px-3 py-3" style={{ backgroundColor: palette.column }}>
        <div aria-label="Preview card" role="img" className="pointer-events-none">
          <PlanCardFace
            item={preview.item}
            palette={palette}
            fields={board.cardFields ?? CARD_FIELDS}
            size={readCardSize(board.cardSize)}
            typeOverride={shownType}
          />
        </div>
      </div>
      <ul aria-label="Where each answer goes" className="flex flex-col">
        {preview.lines.map((l) => (
          <Line
            key={l.questionId ?? `set:${l.label}`}
            label={l.label}
            value={l.value || <span className="text-slate-400">Empty</span>}
            on={!!l.questionId && l.questionId === lit}
            linked={!!l.questionId}
            onHover={hover(l.questionId)}
          />
        ))}
        {preview.description.length ? (
          <Line
            label="Description"
            on={preview.description.some((d) => d.questionId && d.questionId === lit)}
            linked={false}
            onHover={() => {}}
            value={
              <span className="flex flex-col gap-1.5">
                {preview.description.map((d, i) => (
                  <span
                    key={d.questionId ?? i}
                    onPointerEnter={() => d.questionId && setHovered(d.questionId)}
                    onPointerLeave={() => setHovered(null)}
                    className={`-mx-1 rounded px-1 ${
                      d.questionId && d.questionId === lit
                        ? 'bg-brand-100 dark:bg-brand-500/25'
                        : ''
                    }`}
                  >
                    {d.prompt ? <strong className="block font-semibold">{d.prompt}</strong> : null}
                    <span className="whitespace-pre-line">{d.answer}</span>
                  </span>
                ))}
              </span>
            }
          />
        ) : null}
      </ul>
    </Disclosure>
  );
}

// The row one response adds, a line per column (the panel is too narrow for the row itself): its header, then
// its sample value.
export function SheetResponsePreview({ form }: { form: FormDefinition }) {
  const cells = useMemo(() => previewSheetRow(form), [form]);
  const [hovered, setHovered] = useState<string | null>(null);
  const over = useQuestionHover(hovered);
  const lit = hovered ?? over;
  return (
    <Disclosure title="What a Response Makes">
      <ul
        aria-label="Preview row"
        className="flex flex-col rounded-lg border border-slate-200 py-1 dark:border-slate-700"
      >
        {cells.map((c, i) => (
          <Line
            key={i}
            label={c.header}
            value={c.value}
            on={!!c.questionId && c.questionId === lit}
            linked={!!c.questionId}
            onHover={(on) => setHovered(on && c.questionId ? c.questionId : null)}
          />
        ))}
      </ul>
    </Disclosure>
  );
}
