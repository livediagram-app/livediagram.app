'use client';

// The page tree's Pages heading with its label filter (docs/specs/030-knowledgebase/page-surface.md "The label
// filter"): Filter by Label at its right where the knowledgebase has labels, a bar under it while a filter is on
// (Labelled, each label a pill with a remove button, then Clear), and the line for a filter no page matches. The
// tree itself draws the pages kept (visiblePageRows).
import { useContext, useState } from 'react';
import { HoverCard, Tooltip } from '@liveknowledge/ui';
import { EditorChromeContext, useEditorChrome } from '@/app/document/[id]/EditorContext';
import { labelFilterStore } from '@/lib/page-labels/label-selection-store';
import { track } from '@/lib/telemetry';
import { LabelChecklist } from './LabelChecklist';
import { LABEL_PILL, LabelDot } from './LabelPill';
import { LabelIcon, LabelRemoveIcon } from './page-labels-icons';
import { useLabelCounts, useLabelsByUse } from './page-labels-state';
import { useChosenLabels } from './useLabelFilter';

const QUIET_BUTTON =
  'inline-flex cursor-pointer items-center rounded-md font-medium text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

type HeadingProps = {
  // The pages the filter keeps (usePageTreeModel), null with no filter on.
  only: ReadonlySet<string> | null | undefined;
  touch?: boolean;
  // The heading's side padding and top padding where it stands (the sidebar's, the sheet's).
  inset: string;
  top: string;
};

const HEADING =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400';

/** The heading; with no editor around it (a preview, a test of the sidebar alone) it is the heading alone. */
export function LabelFilterHeading(props: HeadingProps) {
  return useContext(EditorChromeContext) ? (
    <FilterHeading {...props} />
  ) : (
    <p className={`pb-1 ${props.inset} ${props.top} ${HEADING}`}>Pages</p>
  );
}

function FilterHeading({ only, touch = false, inset, top }: HeadingProps) {
  // No knowledgebase open reads as one with no labels: nothing here is drawn for it.
  const documentId = useEditorChrome((s) => s.documentId) ?? '';
  const labels = useLabelsByUse();
  const counts = useLabelCounts();
  const chosen = useChosenLabels();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const chosenIds = chosen.map((l) => l.id);
  const clear = () => {
    labelFilterStore.clear(documentId);
  };
  const filtering = chosen.length > 0;
  const size = touch ? 'h-11 w-11' : 'h-6 w-6';
  return (
    <>
      <div className={`flex items-center justify-between gap-2 pb-1 ${inset} ${top}`}>
        <p className={HEADING}>Pages</p>
        {labels.length > 0 || filtering ? (
          <Tooltip label="Filter by Label">
            <button
              type="button"
              data-label-filter-button=""
              aria-label={filtering ? `Filter by Label, ${chosen.length} on` : 'Filter by Label'}
              aria-haspopup="menu"
              aria-expanded={anchor !== null}
              onClick={(e) => setAnchor(e.currentTarget)}
              className={`relative -my-1 inline-flex ${size} shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
                filtering || anchor
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              <LabelIcon />
              {filtering ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand-700 px-0.5 text-[9px] font-semibold leading-none text-white dark:bg-brand-500"
                >
                  <span className="text-optical-centre">{chosen.length}</span>
                </span>
              ) : null}
            </button>
          </Tooltip>
        ) : null}
      </div>
      {filtering ? (
        <div
          role="group"
          aria-label="Label Filter"
          data-label-filter-bar=""
          className={`flex flex-wrap items-center gap-1.5 pb-1.5 pt-1 ${inset}`}
        >
          <span className="text-[12px] text-slate-600 dark:text-slate-400">Labelled</span>
          {chosen.map((label) => (
            <span key={label.id} data-label-filter={label.id} className={`${LABEL_PILL} pr-0.5`}>
              <LabelDot colour={label.colour} />
              <span className="min-w-0 truncate">{label.name}</span>
              <HoverCard title={`Remove the Filter ${label.name}`}>
                <button
                  type="button"
                  aria-label={`Remove the Filter ${label.name}`}
                  onClick={() => labelFilterStore.toggle(documentId, label.id)}
                  className={`${QUIET_BUTTON} ${touch ? 'h-9 w-9' : 'h-5 w-5'} justify-center rounded-full`}
                >
                  <LabelRemoveIcon />
                </button>
              </HoverCard>
            </span>
          ))}
          <button
            type="button"
            data-label-filter-clear=""
            onClick={clear}
            className={`${QUIET_BUTTON} ${touch ? 'h-11' : 'h-6'} px-1.5 text-[12px]`}
          >
            Clear
          </button>
        </div>
      ) : null}
      {filtering && only && only.size === 0 ? (
        <div className={`flex flex-col items-start gap-1 pb-2 pt-1 ${inset}`}>
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            No pages have these labels.
          </p>
          <button
            type="button"
            onClick={clear}
            className={`${QUIET_BUTTON} -mx-1.5 ${touch ? 'h-11' : 'h-7'} px-1.5 text-[13px] text-brand-700 dark:text-brand-300`}
          >
            Clear Filter
          </button>
        </div>
      ) : null}
      <LabelChecklist
        open={anchor !== null}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        title="Filter by Label"
        labels={labels}
        counts={counts}
        chosen={chosenIds}
        onToggle={(id) => {
          const adding = !chosenIds.includes(id);
          labelFilterStore.toggle(documentId, id);
          if (adding) track('UI', 'Used', 'LabelFilter');
        }}
        onClear={clear}
      />
    </>
  );
}
