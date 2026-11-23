'use client';

// The page's labels in its meta row (docs/specs/030-knowledgebase/page-surface.md "Page labels"): each a pill that
// filters the page tree to it, then, for whoever may label the page, Edit Labels; and Add Label beside Add Cover and
// Add Icon on a page with none. Both open the label picker.
import { HoverCard } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { labelFilterStore } from '@/lib/page-labels/label-selection-store';
import { track } from '@/lib/telemetry';
import { useLabelPicker } from './LabelPicker';
import { LABEL_PILL, LabelDot } from './LabelPill';
import { CreateLabelIcon, LabelIcon } from './page-labels-icons';
import { useLabelsEditable, usePageLabels } from './page-labels-state';

// Add Cover's and Add Icon's look (AddIconButton): the row's 13 px and slate, hover room pulled back by its margin.
const GHOST =
  'inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[13px] font-normal leading-5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-200';
const PRESSED = 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200';

/** Add Label, for a page with no labels: the dress pair's third button. No tooltip: its words say it (owner
 *  2026-11-23, page-surface.md "What a page looks like"). */
export function AddLabelButton() {
  const picker = useLabelPicker();
  return (
    <button
      type="button"
      data-add-label=""
      aria-haspopup="dialog"
      aria-expanded={picker.open}
      onClick={(e) => picker.openFrom(e.currentTarget)}
      className={`-mx-1.5 ${GHOST} ${picker.open ? PRESSED : ''}`}
    >
      <LabelIcon />
      Add Label
    </button>
  );
}

/** Whether the meta row shows Add Label: a page with no labels, for whoever may label it. */
export function useAddLabel(): boolean {
  const editable = useLabelsEditable();
  const has = usePageLabels().length > 0;
  return editable && !has;
}

/** The page's label pills, and Edit Labels after them for whoever may change them. Nothing for a page with none. */
export function PageLabelsNote() {
  const labels = usePageLabels();
  const editable = useLabelsEditable();
  const documentId = useEditorChrome((s) => s.documentId);
  const picker = useLabelPicker();
  if (labels.length === 0) return null;
  return (
    <span data-page-labels="" className="inline-flex flex-wrap items-center gap-1.5">
      <span className="sr-only">Labels:</span>
      {labels.map((label) => (
        <HoverCard
          key={label.id}
          title={`Show Pages Labelled ${label.name}`}
          description="Filters the page tree to the pages that carry it."
        >
          <button
            type="button"
            data-page-label={label.id}
            onClick={() => {
              // A page has labels only in an open knowledgebase: the labels are read by its id.
              labelFilterStore.set(documentId!, [label.id], true);
              track('UI', 'Used', 'LabelFilter');
            }}
            className={`${LABEL_PILL} cursor-pointer transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-9 dark:hover:border-slate-600 dark:hover:bg-slate-800`}
          >
            <LabelDot colour={label.colour} />
            <span className="min-w-0 truncate">{label.name}</span>
          </button>
        </HoverCard>
      ))}
      {editable ? (
        <>
          <HoverCard
            title="Edit Labels"
            description="Add or take away this page's labels, or change a label."
            disabled={picker.open}
          >
            <button
              type="button"
              data-edit-labels=""
              aria-label="Edit Labels"
              aria-haspopup="dialog"
              aria-expanded={picker.open}
              onClick={(e) => picker.openFrom(e.currentTarget)}
              className={`${GHOST} w-6 justify-center px-0 phone:w-11 ${picker.open ? PRESSED : ''}`}
            >
              <CreateLabelIcon />
            </button>
          </HoverCard>
        </>
      ) : null}
    </span>
  );
}
