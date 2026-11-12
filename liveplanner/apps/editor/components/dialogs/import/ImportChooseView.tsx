'use client';

// The Import dialog's list (docs/specs/026-plan/plan-tabs.md "The Import dialog"): Into This Tab, then A Board from
// Another Tool for an Editor, each a Plan option list of rows with their icon, name, file type and a line saying what
// file to bring. A file dropped on it is the dialog's (useFileDrop, on every step), which decides where it goes.
import { useEffect, useRef, type ReactNode } from 'react';
import type { TrackerSource } from '@liveplanner/items';
import { OptionRows, type OptionRow } from '@/components/plan/OptionRows';
import type { IntoTab } from './into-tab';
import { intoTabCopy, TOOL_ROWS, TOOLS_NOTE, type ImportRowCopy } from './import-options';
import { ImportError } from './ImportError';

const HEADING =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const NOTE = 'text-[12px] leading-relaxed text-slate-500 dark:text-slate-400';

// The file type at a row's right.
function FileChip({ file }: { file: string }) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {file}
    </span>
  );
}

// A row's line wraps on a narrow screen rather than cutting off where the file lives.
const hintOf = (text: string) => (
  <span className="block text-[12px] leading-snug whitespace-normal">{text}</span>
);

function rowOf(id: string, copy: ImportRowCopy, over: Partial<OptionRow> = {}): OptionRow {
  return {
    id,
    label: copy.label,
    icon: copy.icon,
    detail: hintOf(copy.hint),
    trailing: <FileChip file={copy.file} />,
    ariaLabel: `${copy.label}: ${copy.hint}`,
    ...over,
  };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" aria-labelledby={id}>
      <h3 id={id} className={HEADING}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ImportChooseView({
  intoTab,
  tools,
  reading,
  error,
  onIntoTab,
  onTool,
}: {
  intoTab: IntoTab;
  // Whether this person may import a board from another tool (an Editor).
  tools: boolean;
  // The tool whose file is being read, its row saying so.
  reading: TrackerSource | null;
  error: string | null;
  onIntoTab: () => void;
  onTool: (source: TrackerSource) => void;
}) {
  // The format is the first decision: on a desktop the list opens with focus on its first row that can be pressed (Into
  // This Tab, or Trello when that row is dimmed). Runs before the dialog's focus trap, which keeps a focus already
  // inside. A touch screen leaves it on the panel, so no row lights up unasked (useFocusTrap).
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    list.current
      ?.querySelector<HTMLButtonElement>('button:not([disabled])')
      ?.focus({ preventScroll: true });
  }, []);
  const into = intoTabCopy(intoTab);
  const toolRows = TOOL_ROWS.map((t) =>
    rowOf(t.source, t, reading === t.source ? { detail: hintOf('Reading the File…') } : {}),
  );

  return (
    <div ref={list} data-testid="import-choose" className="flex flex-col gap-5">
      <Section id="import-into-tab" title="Into This Tab">
        <OptionRows
          kind="action"
          label="Into This Tab"
          rows={[rowOf('into', into, intoTab.blocked ? { disabled: true } : {})]}
          onPick={onIntoTab}
        />
        {intoTab.blocked ? <p className={NOTE}>{intoTab.blocked}</p> : null}
      </Section>
      {tools ? (
        <Section id="import-from-tool" title="A Board from Another Tool">
          <div aria-busy={reading !== null}>
            <OptionRows
              kind="action"
              label="A Board from Another Tool"
              rows={toolRows}
              onPick={(id) => onTool(id as TrackerSource)}
            />
          </div>
          <p className={NOTE}>{TOOLS_NOTE}</p>
        </Section>
      ) : null}
      {error ? <ImportError>{error}</ImportError> : null}
    </div>
  );
}
