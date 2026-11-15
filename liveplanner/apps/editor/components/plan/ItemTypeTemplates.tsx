'use client';

// The type editor's Templates tab (docs/specs/026-plan/item-types.md "Editing a type": Templates): the type's card
// templates listed beside the chosen one's editor (the list above it on a phone). Every edit is the draft's: Save
// stores it with the rest of the type, Cancel drops it.
import { useLayoutEffect, useState, type ReactElement } from 'react';
import { CARD_TEMPLATES_MAX, type CardTemplate, type ItemTypeDef } from '@liveplanner/items';
import { Button, CompactEmptyState, PlusIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideClipboardType } from '@liveworkspace/icons/lucide';
import { DashedAddButton } from '@liveworkspace/workbench/components/primitives/DashedAddButton';
import { track } from '@/lib/telemetry';
import { CardTemplateEditor } from './CardTemplateEditor';
import { FieldMenu } from './ItemTypeFieldMenu';
import {
  addTemplate,
  moveTemplate,
  removeTemplate,
  withTemplate,
  type TemplatesProblem,
} from './card-template-draft';

const TemplateGlyph = lucideGlyph(lucideClipboardType, 14);
const EmptyGlyph = lucideGlyph(lucideClipboardType, 18);

export function ItemTypeTemplates({
  type,
  templates,
  onChange,
  problem,
  canEdit,
}: {
  // The type as the draft has it (its name and fields now).
  type: ItemTypeDef;
  templates: readonly CardTemplate[];
  onChange: (next: CardTemplate[]) => void;
  // What about the templates stops Save, shown over the editor.
  problem: TemplatesProblem | null;
  // May change them (an Editor of the whole plan); without it the tab only reads.
  canEdit: boolean;
}) {
  const [chosenId, setChosenId] = useState<string | null>(templates[0]?.id ?? null);
  // The template just added: its Name takes the caret.
  const [freshId, setFreshId] = useState<string | null>(null);
  const chosen = templates.find((t) => t.id === chosenId) ?? templates[0];
  const full = templates.length >= CARD_TEMPLATES_MAX;
  const name = type.label.trim() || 'this type';

  const add = () => {
    const made = addTemplate(templates);
    if (!made.id) return;
    onChange(made.templates);
    setChosenId(made.id);
    setFreshId(made.id);
    track('Plan', 'Added', 'CardTemplate');
  };
  const addRow = canEdit ? (
    <div className="mt-2">
      <DashedAddButton
        label="New Template"
        disabled={full}
        onClick={add}
        className="disabled:cursor-not-allowed disabled:opacity-60"
      />
      {full ? (
        <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          A card type holds up to {CARD_TEMPLATES_MAX} templates.
        </p>
      ) : null}
    </div>
  ) : null;

  if (!chosen)
    return (
      <CompactEmptyState
        icon={<EmptyGlyph />}
        title="No Templates Yet"
        description={`A template fills in a new ${name} card: its title, description, checklist, labels and fields.`}
        className="py-10"
        action={
          canEdit ? (
            <Button variant="primary" onClick={add}>
              <PlusIcon size={12} />
              New Template
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <div className="grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <ul aria-label="Templates" className="flex flex-col gap-0.5">
          {templates.map((t, i) => {
            const on = t.id === chosen.id;
            const label = t.name.trim() || 'Untitled';
            return (
              <li
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                  on
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <ClippedTooltip label={label}>
                  {(nameRef) => (
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => {
                        setChosenId(t.id);
                        setFreshId(null);
                      }}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <span
                        aria-hidden
                        className={
                          on
                            ? 'text-brand-700 dark:text-brand-300'
                            : 'text-slate-400 dark:text-slate-400'
                        }
                      >
                        <TemplateGlyph />
                      </span>
                      <span ref={nameRef} className="truncate">
                        {label}
                      </span>
                    </button>
                  )}
                </ClippedTooltip>
                {canEdit ? (
                  <FieldMenu
                    label={label}
                    moveTargets={[]}
                    onMoveTo={() => {}}
                    canUp={i > 0}
                    canDown={i < templates.length - 1}
                    onMove={(by) => onChange(moveTemplate(templates, t.id, by))}
                    onRemove={() => {
                      const left = removeTemplate(templates, t.id);
                      onChange(left.templates);
                      if (t.id === chosen.id) setChosenId(left.next);
                      track('Plan', 'Deleted', 'CardTemplate');
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {addRow}
      </div>
      <div className="min-w-0">
        {problem ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {problem.message}
          </p>
        ) : null}
        <CardTemplateEditor
          key={chosen.id}
          type={type}
          template={chosen}
          templates={templates}
          canEdit={canEdit}
          fresh={freshId === chosen.id}
          onChange={(next) => onChange(withTemplate(templates, chosen.id, () => next))}
        />
      </div>
    </div>
  );
}

// A row's name as a tooltip only while the row cuts it off: a name shown whole needs none. Measured again when the
// name changes or the row is resized; the name is held by a callback ref, so a row redrawn with or without its
// tooltip is measured afresh.
function ClippedTooltip({
  label,
  children,
}: {
  label: string;
  children: (nameRef: (el: HTMLSpanElement | null) => void) => ReactElement;
}) {
  const [name, setName] = useState<HTMLSpanElement | null>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    if (!name) return;
    const measure = () => setCut(name.scrollWidth > name.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(name);
    return () => watch.disconnect();
  }, [name, label]);
  return <Tooltip label={cut ? label : ''}>{children(setName)}</Tooltip>;
}
