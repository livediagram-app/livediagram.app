import { useState } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { FormatCard } from '@liveworkspace/workbench/components/dialogs/FormatCard';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportReport } from './ImportReport';
import type { ImportFormat as Format } from '@/hooks/persistence/useTabImport';
import { Glyph, DialogCloseButton, DialogHeader } from '@livedocuments/ui';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImportFile: (format: Format) => Promise<ImportOutcome>;
  // Runs a text import (the paste/write path) for the chosen format,
  // bypassing the file picker (docs/specs/020-import-export/markdown-import.md).
  onImportText: (format: Format, text: string) => Promise<ImportOutcome>;
  // The formats offered, in catalogue order; absent offers every one (docs/specs/007-editor/pages-mode.md
  // "Import"); a single format opens straight at its panel.
  formats?: readonly Format[];
  onClose: () => void;
};

// Per-format copy for the grid card + the paste-panel placeholder. Every
// format is a text format, so each opens the same paste-or-file panel.
const FORMATS: {
  key: Format;
  title: string;
  description: string;
  placeholder: string;
  // Optional footnote for this format's paste step — a help link for a
  // format whose mapping isn't obvious from the placeholder alone. It rides
  // on the format rather than the picker screen so it appears once the
  // reader has actually chosen that format and the answer is relevant.
  note?: { article: 'markdownImport'; label: string };
}[] = [
  {
    key: 'json',
    title: 'JSON',
    description:
      'A livedocuments tab (a .json export). Restores its elements exactly. Paste it or pick a file.',
    placeholder: '{\n  "schemaVersion": 1,\n  "kind": "livedocuments.tab",\n  "tab": { … }\n}',
  },
  {
    key: 'markdown',
    title: 'Markdown',
    description: 'A .md file. Becomes an article, its headings, lists and paragraphs kept.',
    placeholder: '# Project\n\nWhy we are doing this.\n\n- Research\n- Build\n- Launch',
    note: { article: 'markdownImport', label: 'See how Markdown becomes an article' },
  },
];

// Counterpart to ExportTabDialog: pick a format to import INTO the current
// tab. Importing REPLACES the tab's contents (docs/specs/020-import-export/markdown-import.md), so the dialog leads
// with a warning before the format cards. Every format is text, so each card
// opens the same two-step panel: paste/write the content, or pick a file.
// Errors render inline; on success the dialog closes.
type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// An import shows its report when part of it could not land.
function needsReport(outcome: DoneOutcome): boolean {
  return (outcome.failures?.length ?? 0) > 0;
}

export function ImportTabDialog({
  tabName,
  onImportFile,
  onImportText,
  onClose,
  formats,
}: ImportTabDialogProps) {
  const offered = formats ? FORMATS.filter((f) => formats.includes(f.key)) : FORMATS;
  // One format offered: no list to pick from, so its panel is the dialog.
  const only = offered.length === 1 ? offered[0]!.key : null;
  const [active, setActive] = useState<Format | null>(only);
  // Set once an import that left something out has landed: the dialog then shows how it came across instead of
  // closing.
  const [report, setReport] = useState<DoneOutcome | null>(null);
  const activeFormat = active ? FORMATS.find((f) => f.key === active) : null;

  return (
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      <DialogHeader
        title="Import to Tab"
        subtitle={
          report
            ? "Here's how your import came across."
            : activeFormat
              ? `Paste your ${activeFormat.title}, or import a file.`
              : 'Pick a format to import into the current tab.'
        }
      >
        <HelpArticleLink article="importTabs" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {report ? (
          <ImportReport failures={report.failures} onDone={onClose} />
        ) : (
          <ImportChooser
            tabName={tabName}
            activeFormat={activeFormat ?? null}
            formats={offered}
            onPick={setActive}
            single={only !== null}
            onImportFile={onImportFile}
            onImportText={onImportText}
            onDone={(outcome) => (needsReport(outcome) ? setReport(outcome) : onClose())}
          />
        )}
      </div>
    </Dialog>
  );
}

// The warning plus either the format grid or the chosen format's panel.
function ImportChooser({
  tabName,
  activeFormat,
  formats,
  onPick,
  onImportFile,
  onImportText,
  onDone,
  single,
}: {
  tabName: string;
  activeFormat: (typeof FORMATS)[number] | null;
  formats: typeof FORMATS;
  onPick: (format: Format | null) => void;
  single: boolean;
  onImportFile: ImportTabDialogProps['onImportFile'];
  onImportText: ImportTabDialogProps['onImportText'];
  onDone: (outcome: Extract<ImportOutcome, { status: 'done' }>) => void;
}) {
  return (
    <>
      {/* Destructive-action warning — this overwrites the tab. */}
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="mt-0.5 shrink-0">
          <WarningIcon />
        </span>
        <span>
          This replaces everything on{' '}
          <strong className="font-semibold">{tabName || 'this tab'}</strong> with the imported
          content. Undo
          {/* The keys only where there is a keyboard to press them. */}
          <span className="pointer-coarse:hidden"> (⌘Z / Ctrl&#8209;Z)</span> brings it back.
        </span>
      </div>
      {activeFormat ? (
        <TextImportPanel
          formatTitle={activeFormat.title}
          placeholder={activeFormat.placeholder}
          /* Quiet footnote for this format. It used to sit under the picker
               grid, where it asked "Importing a Markdown outline?" of a reader
               who had not picked a format yet — an answer to a question nobody
               had. */
          note={
            activeFormat.note ? (
              <HelpArticleLink
                article={activeFormat.note.article}
                variant="text"
                label={activeFormat.note.label}
              />
            ) : null
          }
          onImportText={(text) => onImportText(activeFormat.key, text)}
          onImportFile={() => onImportFile(activeFormat.key)}
          onDone={onDone}
          onBack={single ? undefined : () => onPick(null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {formats.map((f) => (
            <FormatCard
              key={f.key}
              title={f.title}
              description={f.description}
              onClick={() => onPick(f.key)}
            >
              <FormatIcon kind={f.key} />
            </FormatCard>
          ))}
        </div>
      )}
    </>
  );
}

function FormatIcon({ kind }: { kind: Format }) {
  const label = kind === 'markdown' ? 'md' : 'json';
  return (
    <svg width="36" height="20" viewBox="0 0 36 20" aria-hidden>
      <rect
        x="1"
        y="1"
        width="34"
        height="18"
        rx="2"
        fill="none"
        stroke="rgb(148 163 184)"
        strokeWidth="1.25"
      />
      <text
        x="18"
        y="14"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="9"
        fontWeight="600"
        fill="rgb(71 85 105)"
      >
        {label}
      </text>
    </svg>
  );
}

function WarningIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 2.5 1.5 14h13L8 2.5Z" />
      <path d="M8 6.5v3.5" />
      <path d="M8 12h.01" />
    </Glyph>
  );
}
