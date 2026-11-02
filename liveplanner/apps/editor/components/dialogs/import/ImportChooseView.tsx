'use client';

// The Import dialog's list (docs/specs/026-plan/plan-tabs.md "The Import dialog"): Into This Tab, then A Board from
// Another Tool for an Editor, each a Plan option list of rows with their icon, name, file type and a line saying what
// file to bring. A file dropped anywhere on it is read as what it is (the dialog decides where it goes).
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideFileDown } from '@liveworkspace/icons/lucide';
import type { TrackerSource } from '@liveplanner/items';
import { OptionRows, type OptionRow } from '@/components/plan/OptionRows';
import type { IntoTab } from './into-tab';
import { intoTabCopy, TOOL_ROWS, TOOLS_NOTE, type ImportRowCopy } from './import-options';
import { ImportError } from './ImportError';

const HEADING =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const NOTE = 'text-[12px] leading-relaxed text-slate-500 dark:text-slate-400';
const DropIcon = lucideGlyph(lucideFileDown, 22);

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
  onDropFile,
}: {
  intoTab: IntoTab;
  // Whether this person may import a board from another tool (an Editor).
  tools: boolean;
  // The tool whose file is being read, its row saying so.
  reading: TrackerSource | null;
  error: string | null;
  onIntoTab: () => void;
  onTool: (source: TrackerSource) => void;
  onDropFile: (file: File) => void;
}) {
  // Entering a child fires before leaving its parent: a count keeps the outline steady over the rows.
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const dragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const dragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  const into = intoTabCopy(intoTab);
  const toolRows = TOOL_ROWS.map((t) =>
    rowOf(t.source, t, reading === t.source ? { detail: hintOf('Reading the File…') } : {}),
  );

  return (
    <div
      data-testid="import-choose"
      className="relative flex flex-col gap-5"
      onDragEnter={dragEnter}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
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
      {over ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-white/90 text-brand-700 animate-fade-in dark:border-brand-500/70 dark:bg-slate-900/90 dark:text-brand-200"
        >
          <DropIcon />
          <span className="text-sm font-semibold">Drop to Import</span>
        </div>
      ) : null}
    </div>
  );
}
