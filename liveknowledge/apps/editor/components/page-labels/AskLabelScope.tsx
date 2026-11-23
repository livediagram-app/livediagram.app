'use client';

// Answer From, above the Ask view's field (docs/specs/030-knowledgebase/search-and-ask.md "Answer From"): where the
// knowledgebase has labels, a quiet All Pages button opens the labels' menu; with some chosen it reads Only and each
// label as a pill with a remove button, and the next question is answered from those pages alone. The choice is this
// person's, per knowledgebase, while the browser tab lives. Under an answer asked so, AnsweredFromLabels says it.
import { useState } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import {
  askLabelScopeStore,
  chosenOf,
  labelNamesText,
} from '@/lib/page-labels/label-selection-store';
import { LabelChecklist } from './LabelChecklist';
import { LABEL_PILL, LabelDot } from './LabelPill';
import { LabelChevronIcon, LabelIcon, LabelRemoveIcon } from './page-labels-icons';
import { useKnowledgeLabels, useLabelCounts, useLabelsByUse } from './page-labels-state';
import { useChosenLabels } from './useLabelFilter';

const QUIET =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function AskLabelScope() {
  const documentId = useEditorChrome((s) => s.documentId);
  const labels = useLabelsByUse();
  const counts = useLabelCounts();
  const chosen = useChosenLabels(askLabelScopeStore);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!documentId || (labels.length === 0 && chosen.length === 0)) return null;
  const chosenIds = chosen.map((l) => l.id);
  return (
    <div data-ask-label-scope="" className="flex flex-wrap items-center gap-1.5 px-1">
      <HoverCard
        title="Answer From"
        description="Answer the next question from the pages of some labels only, or from every page."
        disabled={anchor !== null}
      >
        <button
          type="button"
          data-ask-label-scope-button=""
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-label={
            chosen.length ? `Answer Only From ${labelNamesText(chosen)}` : 'Answer From All Pages'
          }
          onClick={(e) => setAnchor(e.currentTarget)}
          className={`${QUIET} -ml-1.5`}
        >
          <LabelIcon />
          {chosen.length ? 'Only' : 'All Pages'}
          <LabelChevronIcon />
        </button>
      </HoverCard>
      {chosen.map((label) => (
        <span key={label.id} data-ask-label={label.id} className={`${LABEL_PILL} pr-0.5`}>
          <LabelDot colour={label.colour} />
          <span className="min-w-0 truncate">{label.name}</span>
          <HoverCard title={`Stop Answering Only From ${label.name}`}>
            <button
              type="button"
              aria-label={`Stop Answering Only From ${label.name}`}
              onClick={() => askLabelScopeStore.toggle(documentId, label.id)}
              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-9 phone:w-9 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <LabelRemoveIcon />
            </button>
          </HoverCard>
        </span>
      ))}
      <LabelChecklist
        open={anchor !== null}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        title="Answer From"
        labels={labels}
        counts={counts}
        chosen={chosenIds}
        onToggle={(id) => askLabelScopeStore.toggle(documentId, id)}
        onClear={() => askLabelScopeStore.clear(documentId)}
      />
    </div>
  );
}

/** "From pages labelled Engineering", under an answer asked under labels; nothing for one asked of every page. */
export function AnsweredFromLabels({ ids }: { ids: readonly string[] | undefined }) {
  const labels = useKnowledgeLabels();
  if (!ids?.length) return null;
  const named = chosenOf(ids, labels);
  if (named.length === 0) return null;
  return (
    <p
      data-ask-from-labels=""
      className="mt-1.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400"
    >
      From pages labelled {labelNamesText(named)}
    </p>
  );
}
