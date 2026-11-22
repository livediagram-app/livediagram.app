'use client';

// A page's Health Score as a small chip (docs/specs/030-knowledgebase/verification.md "Health Score"): the figure
// and its word in the word's colour, never colour alone. Knowledge Health's low pages, a conflict's sides and Ask's
// source cards draw it.
import { HEALTH_LABEL_WORDS, type PageHealthLabel } from '@liveknowledge/knowledge';
import { HEALTH_TONE } from './PageHealthScore';

export function HealthChip({
  score,
  label,
  prefix = false,
}: {
  score: number;
  label: PageHealthLabel;
  /** "Health 42, Needs Work" in place of "42 Needs Work", where the chip stands without a heading. */
  prefix?: boolean;
}) {
  return (
    <span
      data-health-chip={label}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${HEALTH_TONE[label].chip}`}
    >
      <span className="font-semibold tabular-nums">{prefix ? `Health ${score},` : score}</span>
      {HEALTH_LABEL_WORDS[label]}
    </span>
  );
}
