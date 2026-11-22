'use client';

// What a step in another app will write, under its panel (blueprint cross-app.md "In the builder"): each text as it
// will land, its values as the chips the text boxes show (they are filled in when the rule runs), and where it lands.
// Live: it follows every key typed.
import type { ReactNode } from 'react';
import { ChipText, useValueLabels } from '../value-labels';

export function CrossAppPreview({
  outline,
  where,
  lines,
  note,
}: {
  outline: unknown;
  // Where it lands, in words: "Kanban · To Do in “Launch”".
  where: string;
  // Each text, labelled ("Title", "Body"); an empty one is left out.
  lines: readonly { label: string; text: string }[];
  note?: ReactNode;
}) {
  const labels = useValueLabels(outline);
  const shown = lines.filter((l) => l.text.trim());
  return (
    <section
      aria-label="Preview"
      data-cross-preview=""
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        Preview
      </span>
      <span className="text-[12px] text-slate-500 dark:text-slate-400">{where}</span>
      {shown.length ? (
        <dl className="flex flex-col gap-1.5">
          {shown.map((l) => (
            <div key={l.label} className="flex flex-col gap-0.5">
              <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {l.label}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-[13px] text-slate-900 dark:text-slate-50">
                <ChipText text={l.text} labels={labels} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Nothing written yet.</p>
      )}
      {note ? <p className="text-[12px] text-slate-500 dark:text-slate-400">{note}</p> : null}
    </section>
  );
}
