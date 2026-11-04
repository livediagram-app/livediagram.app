import { useState, type CSSProperties } from 'react';
import { PROJECT_DESCRIPTION_MAX } from '@liveplanner/api-schema';
import { NAME_MAX_LENGTH } from '@liveworkspace/model-core/names';
import { Tooltip } from '@liveplanner/ui';
import { EditInPlace } from './EditInPlace';
import type { PlanPerson } from './overview-people';
import { OverviewPeople } from './OverviewPeople';

// The Overview's header band (docs/specs/026-plan/plan-overview.md "Header"): the plan's name, description and dates,
// edited in place for whoever may edit the plan, and the people on it.
export function OverviewHeader({
  name,
  description,
  dates,
  datesTitle,
  people,
  onRename,
  onDescribe,
  paint,
}: {
  name: string;
  description: string;
  dates: string | null;
  // The exact last edit, on hover over the dates line.
  datesTitle?: string | undefined;
  people: readonly PlanPerson[];
  // Both absent for anyone who may not edit the whole plan: the name and description are then plain text.
  onRename?: ((name: string) => void) | undefined;
  onDescribe?: ((description: string) => void) | undefined;
  // The header's colours from the Overview's theme (overview-header-paint.ts); absent, the app's own.
  paint?: CSSProperties | undefined;
}) {
  const [editing, setEditing] = useState<'name' | 'description' | null>(null);
  const end = () => setEditing(null);
  return (
    <section
      aria-labelledby="overview-title"
      data-overview-header=""
      className={HEADER_CLASS}
      style={paint}
    >
      {/* The theme's rule along the top: its accent, or a multicolour theme's branch colours. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 [background:var(--ov-head-rule,var(--color-brand-500))]"
      />
      <div className="flex min-w-0 max-w-[720px] flex-1 basis-[min(100%,16rem)] flex-col gap-2">
        <span
          className={`text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] ${ACCENT_TEXT}`}
        >
          Plan Overview
        </span>
        {onRename ? (
          <EditInPlace
            kind="name"
            as="h1"
            id="overview-title"
            textClass={NAME_CLASS}
            value={name || 'Untitled'}
            label="Rename"
            fieldLabel="Plan Name"
            maxLength={NAME_MAX_LENGTH}
            editing={editing === 'name'}
            onStart={() => setEditing('name')}
            onEnd={end}
            onSave={onRename}
          />
        ) : (
          <h1 id="overview-title" className={NAME_CLASS}>
            {name || 'Untitled'}
          </h1>
        )}
        {onDescribe && (description || editing === 'description') ? (
          <EditInPlace
            kind="description"
            as="p"
            textClass={DESCRIPTION_CLASS}
            textData={{ 'data-overview-description': '' }}
            value={description}
            label="Edit Description"
            fieldLabel="Description"
            placeholder="What is this plan for?"
            maxLength={PROJECT_DESCRIPTION_MAX}
            editing={editing === 'description'}
            onStart={() => setEditing('description')}
            onEnd={end}
            onSave={onDescribe}
          />
        ) : description ? (
          <p data-overview-description="" className={DESCRIPTION_CLASS}>
            {description}
          </p>
        ) : onDescribe ? (
          <button
            type="button"
            onClick={() => setEditing('description')}
            className={`w-fit cursor-pointer rounded text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${ACCENT_TEXT}`}
          >
            Add a Description
          </button>
        ) : null}
        {dates ? (
          <Tooltip label={datesTitle ?? ''}>
            <span className={`w-fit text-xs ${MUTED_TEXT}`}>{dates}</span>
          </Tooltip>
        ) : null}
      </div>
      <OverviewPeople people={people} />
    </section>
  );
}

// Each colour is the theme's (the --ov-head-* properties), with the app's own as the fallback where none is handed.
const HEADER_CLASS =
  'relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[var(--ov-head-line,var(--color-brand-100))] [background:var(--ov-head-bg,var(--color-brand-50))] px-4 pb-6 pt-8 sm:px-10 dark:border-[var(--ov-head-line,var(--color-brand-900))] dark:[background:var(--ov-head-bg,var(--color-brand-950))]';
const ACCENT_TEXT =
  'text-[var(--ov-head-accent,var(--color-brand-700))] dark:text-[var(--ov-head-accent,var(--color-brand-300))]';
const MUTED_TEXT =
  'text-[var(--ov-head-muted,var(--color-slate-600))] dark:text-[var(--ov-head-muted,var(--color-brand-200))]';
const NAME_CLASS =
  'break-words text-[28px] font-bold leading-tight tracking-tight text-[var(--ov-head-ink,var(--color-slate-950))] sm:text-[34px] dark:text-[var(--ov-head-ink,var(--color-white))]';
const DESCRIPTION_CLASS =
  'whitespace-pre-line break-words text-sm leading-relaxed text-[var(--ov-head-ink,var(--color-slate-700))] dark:text-[var(--ov-head-ink,var(--color-brand-100))]';
