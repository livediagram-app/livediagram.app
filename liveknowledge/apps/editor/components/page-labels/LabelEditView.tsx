'use client';

// One label, opened in place in the label picker (docs/specs/030-knowledgebase/page-surface.md "Page labels"): the
// shared back bar to the list, its Name (renamed when Enter or Done is pressed, a taken name refused in place), its
// Colour in the one colour picker, and Delete Label, which asks first. Each change is one write of the
// knowledgebase's labels, whatever the number of pages that carry it.
import { useEffect, useId, useRef, useState } from 'react';
import {
  LABEL_NAME_MAX,
  LABEL_REFUSAL_WORDS,
  applyLabelChange,
  type KnowledgeLabel,
} from '@liveknowledge/document';
import { BackBar, Button, TextInput, useAppearance } from '@liveknowledge/ui';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { standardGroup } from '@liveworkspace/workbench/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { LabelDeleteIcon } from './page-labels-icons';
import type { LabelActions } from './page-labels-state';

const NO_THEME: readonly never[] = [];

export function LabelEditView({
  titleId,
  label,
  pages,
  labels,
  actions,
  onBack,
}: {
  titleId: string;
  label: KnowledgeLabel;
  pages: number;
  labels: readonly KnowledgeLabel[];
  actions: LabelActions;
  onBack: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const confirm = useConfirm();
  const { appearance } = useAppearance();
  const yours = useDocumentColours();

  useEffect(() => {
    const id = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const rename = async () => {
    if (name.trim() === label.name) return onBack();
    // Judged here first, as the api judges it, so a taken name is said beside the field.
    const judged = applyLabelChange(labels, { kind: 'rename', id: label.id, name });
    if ('refusal' in judged) return setError(LABEL_REFUSAL_WORDS[judged.refusal]);
    if (await actions.rename(label.id, name)) onBack();
  };
  const remove = async () => {
    const ok = await confirm({
      title: `Delete the Label ${label.name}?`,
      message:
        pages === 0
          ? 'No page carries it. This cannot be undone.'
          : `It comes off the ${pages === 1 ? 'page' : `${pages} pages`} that carry it. This cannot be undone.`,
      confirmLabel: 'Delete Label',
    });
    if (!ok) return;
    onBack();
    await actions.remove(label.id);
  };

  return (
    <div data-label-edit-view="" className="flex flex-col">
      <h2 id={titleId} className="sr-only">
        Edit Label {label.name}
      </h2>
      <BackBar label="Labels" current={label.name} onClick={onBack} />
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void rename();
        }}
      >
        <label
          htmlFor={`${errorId}-name`}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          Name
        </label>
        <div className="flex items-center gap-2">
          <TextInput
            ref={field}
            id={`${errorId}-name`}
            compact
            value={name}
            maxLength={LABEL_NAME_MAX}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!name.trim()}>
            Done
          </Button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </form>
      <p className="mb-1.5 mt-4 text-xs font-semibold text-slate-700 dark:text-slate-300">Colour</p>
      <ColourPicker
        label="Label Colour"
        value={label.colour}
        // A label is not the page's design: no Theme Palette, only the standard colours and the team's own.
        theme={NO_THEME}
        standard={[standardGroup('strong', appearance, 'name')]}
        yours={yours}
        onPick={(colour) => {
          if (colour !== label.colour) void actions.recolour(label.id, colour);
        }}
      />
      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button
          type="button"
          data-label-delete=""
          onClick={() => void remove()}
          className="-mx-1.5 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-slate-600 transition-colors duration-micro hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
        >
          <LabelDeleteIcon />
          Delete Label
        </button>
      </div>
    </div>
  );
}
