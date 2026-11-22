import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ImportSource } from '@liveknowledge/knowledge-import';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { FormatCard } from '@liveworkspace/workbench/components/dialogs/FormatCard';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import { FileImportPanel } from './FileImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportReport } from '@liveworkspace/workbench/components/dialogs/ImportReport';
import type {
  FileImportFormat,
  FileImportStage,
  ImportFormat as Format,
  TextImportFormat,
} from '@/hooks/persistence/useTabImport';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
import { Callout } from '@liveworkspace/ui/callout';
import type { KnowledgeImportProps } from './knowledge-import/KnowledgeImportPanel';
import { KNOWLEDGE_SOURCES, knowledgeSourceOf } from './knowledge-import/sources';

// A Knowledgebase import's steps and its engine, loaded when one of its sources is chosen: a single-file import
// never pays for them.
const KnowledgeImportPanel = dynamic(
  () => import('./knowledge-import/KnowledgeImportPanel').then((m) => m.KnowledgeImportPanel),
  { ssr: false },
);

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImportFile: (format: TextImportFormat) => Promise<ImportOutcome>;
  // Runs a text import (the paste/write path) for the chosen format,
  // bypassing the file picker (docs/specs/020-import-export/markdown-import.md).
  onImportText: (format: TextImportFormat, text: string) => Promise<ImportOutcome>;
  // Runs a Word or PowerPoint import of a dropped or chosen file (docs/specs/020-import-export/office-import.md),
  // reporting its stage as it goes.
  onImportFileFormat: (
    format: FileImportFormat,
    file: File,
    onStage: (stage: FileImportStage) => void,
  ) => Promise<ImportOutcome>;
  // The formats offered, in catalogue order; absent offers every one (docs/specs/007-editor/pages-mode.md
  // "Import"); a single format opens straight at its panel.
  formats?: readonly Format[];
  // A whole knowledgebase brought in from a Markdown folder, Notion or Confluence
  // (docs/specs/020-import-export/knowledgebase-import.md): the three sources join the formats as choices. Present
  // for an Editor only; a Participant or a Viewer is handed none and sees none.
  knowledgebase?: KnowledgeImportProps;
  onClose: () => void;
};

// Per-format copy for the grid card and its panel. A text format opens the paste-or-file panel with its
// placeholder; a file format (Word, PowerPoint) opens the file panel.
type FormatEntry = {
  title: string;
  description: string;
  // Optional footnote for this format's panel — a help link for a
  // format whose mapping isn't obvious from the placeholder alone. It rides
  // on the format rather than the picker screen so it appears once the
  // reader has actually chosen that format and the answer is relevant.
  note?: { article: 'markdownImport' | 'importTabs'; label: string };
} & (
  | { key: TextImportFormat; kind: 'text'; placeholder: string }
  | { key: FileImportFormat; kind: 'file' }
);

const FORMATS: FormatEntry[] = [
  {
    key: 'json',
    kind: 'text',
    title: 'JSON',
    description:
      'A liveknowledge page (a .json export). Restores it exactly. Paste it or pick a file.',
    placeholder: '{\n  "schemaVersion": 1,\n  "kind": "liveknowledge.tab",\n  "tab": { … }\n}',
  },
  {
    key: 'markdown',
    kind: 'text',
    title: 'Markdown',
    description: 'A .md file. Becomes an article, its headings, lists and paragraphs kept.',
    placeholder: '# Project\n\nWhy we are doing this.\n\n- Research\n- Build\n- Launch',
    note: { article: 'markdownImport', label: 'See how Markdown becomes an article' },
  },
  {
    key: 'word',
    kind: 'file',
    title: 'Word',
    description: 'A .docx from Word or Google Docs. Becomes an article.',
    note: { article: 'importTabs', label: 'How Word import works' },
  },
  {
    key: 'powerpoint',
    kind: 'file',
    title: 'PowerPoint',
    description: 'A .pptx from PowerPoint or Google Slides. Becomes slide pages.',
    note: { article: 'importTabs', label: 'How PowerPoint import works' },
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
  onImportFileFormat,
  onClose,
  formats,
  knowledgebase,
}: ImportTabDialogProps) {
  const titleId = useId();
  const offered = formats ? FORMATS.filter((f) => formats.includes(f.key)) : FORMATS;
  // One format offered and no knowledgebase sources beside it: no list to pick from, so its panel is the dialog.
  const only = offered.length === 1 && !knowledgebase ? offered[0]!.key : null;
  const [active, setActive] = useState<Format | null>(only);
  // The knowledgebase source chosen, when one is.
  const [source, setSource] = useState<ImportSource | null>(null);
  // Set once an import that left something out has landed: the dialog then shows how it came across instead of
  // closing.
  const [report, setReport] = useState<DoneOutcome | null>(null);
  const activeFormat = active ? FORMATS.find((f) => f.key === active) : null;

  return (
    <Dialog open onClose={onClose} ariaLabel="Import Into Page" size="xl" className="max-h-[90vh]">
      {/* The dialog hero header (dialog-hero-header.md): files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title={
          source ? 'Import a Knowledgebase' : knowledgebase && !active ? 'Import' : 'Import to Page'
        }
        subtitle={
          source
            ? `Bring every page in from ${source === 'markdown-folder' ? 'a Markdown folder' : knowledgeSourceOf(source).title}.`
            : report
              ? "Here's how your import came across."
              : activeFormat?.kind === 'file'
                ? `Import a ${activeFormat.title} file.`
                : activeFormat
                  ? `Paste your ${activeFormat.title}, or import a file.`
                  : knowledgebase
                    ? 'Import into this page, or bring in a whole knowledgebase.'
                    : 'Pick a format to import into the current page.'
        }
        actions={<HelpArticleLink article="importTabs" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {source && knowledgebase ? (
          <KnowledgeImportPanel
            // A fresh import per source, so nothing carries across.
            key={source}
            {...knowledgebase}
            source={source}
            onBack={() => setSource(null)}
            onClose={onClose}
          />
        ) : report ? (
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
            onImportFileFormat={onImportFileFormat}
            onDone={(outcome) => (needsReport(outcome) ? setReport(outcome) : onClose())}
            onPickSource={knowledgebase ? setSource : undefined}
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
  onImportFileFormat,
  onDone,
  single,
  onPickSource,
}: {
  // Present when a whole knowledgebase can be imported too: the grid then holds both kinds of import, each under
  // its heading, and the warning sits with the formats it is about.
  onPickSource?: (source: ImportSource) => void;
  tabName: string;
  activeFormat: FormatEntry | null;
  formats: FormatEntry[];
  onPick: (format: Format | null) => void;
  single: boolean;
  onImportFile: ImportTabDialogProps['onImportFile'];
  onImportText: ImportTabDialogProps['onImportText'];
  onImportFileFormat: ImportTabDialogProps['onImportFileFormat'];
  onDone: (outcome: Extract<ImportOutcome, { status: 'done' }>) => void;
}) {
  // Destructive-action warning: a single-file import overwrites the page.
  const warning = (
    <Callout tone="warning" className="mb-4">
      This replaces everything on{' '}
      <strong className="font-semibold">{tabName || 'this page'}</strong> with the imported content.
      Undo brings it back.
    </Callout>
  );
  if (!activeFormat && onPickSource) {
    return (
      <>
        <section aria-labelledby="import-into-page">
          <h3 id="import-into-page" className={GROUP_HEADING}>
            Into This Page
          </h3>
          {warning}
          <FormatGrid formats={formats} onPick={onPick} />
        </section>
        <section aria-labelledby="import-knowledgebase" className="mt-6">
          <h3 id="import-knowledgebase" className={GROUP_HEADING}>
            A Whole Knowledgebase
          </h3>
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
            Every page with its place in the tree, its links and its pictures. You see what was
            found before anything is imported.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {KNOWLEDGE_SOURCES.map((s) => (
              <FormatCard
                key={s.key}
                title={s.title}
                description={s.description}
                fileTypes={s.fileTypes}
                onClick={() => onPickSource(s.key)}
              >
                <span className="text-slate-600">
                  <s.Icon size={24} />
                </span>
              </FormatCard>
            ))}
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      {warning}
      {activeFormat?.kind === 'file' ? (
        <FileImportPanel
          // A fresh panel per format, so a stale error never carries across.
          key={activeFormat.key}
          format={activeFormat.key}
          note={
            activeFormat.note ? (
              <HelpArticleLink
                article={activeFormat.note.article}
                variant="text"
                label={activeFormat.note.label}
              />
            ) : null
          }
          onImportFile={(file, onStage) => onImportFileFormat(activeFormat.key, file, onStage)}
          onDone={onDone}
          onBack={single ? undefined : () => onPick(null)}
        />
      ) : activeFormat ? (
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
        <FormatGrid formats={formats} onPick={onPick} />
      )}
    </>
  );
}

const GROUP_HEADING = 'mb-2 text-xs font-semibold text-slate-900 dark:text-slate-100';

// The single-file formats, a card each.
function FormatGrid({
  formats,
  onPick,
}: {
  formats: FormatEntry[];
  onPick: (format: Format | null) => void;
}) {
  return (
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
  );
}

function FormatIcon({ kind }: { kind: Format }) {
  const label = { json: 'json', markdown: 'md', word: 'docx', powerpoint: 'pptx' }[kind];
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
