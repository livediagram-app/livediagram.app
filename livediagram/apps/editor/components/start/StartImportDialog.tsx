'use client';

// The start screen's Import (docs/specs/007-editor/start-diagramming.md "Import"): the rail's Import entry opens this
// list of the tools livediagram imports from, each a row with its mark, name, file type and a line saying what file to
// bring, in the shape of liveplanner's Import dialog. Picking one opens that tool's import into this tab
// (useStartImport).
import { useEffect, useId, useRef } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  OptionRows,
  type OptionRow,
} from '@liveworkspace/workbench/components/primitives/OptionRows';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { IMPORT_SOURCES, type ImportSourceId } from '@/app/import/import-sources';

const HEADING =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const NOTE = 'text-[12px] leading-relaxed text-slate-500 dark:text-slate-400';

// Each tool's file type and where its file comes from.
const ROW_COPY: Readonly<Record<ImportSourceId, { file: string; hint: string }>> = {
  'microsoft-whiteboard': {
    file: 'ZIP',
    hint: 'A board folder, a folder of boards, or their .zip from Microsoft Whiteboard',
  },
  excalidraw: {
    file: '.excalidraw',
    hint: 'A scene, or a PNG / SVG exported with the scene',
  },
  drawio: {
    file: '.drawio',
    hint: 'A diagram from draw.io or diagrams.net',
  },
};

export const START_IMPORT_NOTE = 'It goes into this tab, in place of its start.';

// The file type at a row's right.
function FileChip({ file }: { file: string }) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {file}
    </span>
  );
}

// The source's painted mark, at an option row's icon size.
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10 [&>svg]:h-8 [&>svg]:w-8">
      {children}
    </span>
  );
}

const ROWS: readonly OptionRow[] = IMPORT_SOURCES.map((s) => ({
  id: s.id,
  label: s.name,
  icon: <Mark>{s.icon}</Mark>,
  // The line wraps on a narrow screen rather than cutting off where the file lives.
  detail: (
    <span className="block text-[12px] leading-snug whitespace-normal">{ROW_COPY[s.id].hint}</span>
  ),
  trailing: <FileChip file={ROW_COPY[s.id].file} />,
  ariaLabel: `${s.name}: ${ROW_COPY[s.id].hint}`,
}));

export function StartImportDialog({
  onPick,
  onClose,
}: {
  onPick: (source: ImportSourceId) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  // The tool is the first decision: on a desktop the list opens with focus on its first row. A touch screen leaves it
  // on the panel, so no row lights up unasked.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    list.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, []);
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Import"
      size="xl"
      className="max-h-[90vh]"
      initialFocus="container"
    >
      {/* The dialog hero header (dialog-hero-header.md): files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title="Import"
        subtitle="Bring a board into this tab."
        actions={<HelpArticleLink article="importTabs" size="md" />}
        onClose={onClose}
      />
      <div ref={list} data-testid="start-import" className="flex flex-col gap-1.5 p-5">
        <h3 id={`${titleId}-tools`} className={HEADING}>
          A Board from Another Tool
        </h3>
        <OptionRows
          kind="action"
          label="A Board from Another Tool"
          rows={ROWS}
          onPick={(id) => onPick(id as ImportSourceId)}
        />
        <p className={NOTE}>{START_IMPORT_NOTE}</p>
      </div>
    </Dialog>
  );
}
