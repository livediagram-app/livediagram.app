import { useId, useState } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { FormatCard } from '@liveworkspace/workbench/components/dialogs/FormatCard';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import { FileImportPanel } from './FileImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportImageProgress } from '@/lib/import-images';
import { reportHasLosses } from '@/lib/board-scene/report';
import { ImportImageReport } from './ImportImageReport';
import type { ImportFormat as Format } from '@/hooks/persistence/useTabImport';
import { importFileTypes } from '@/lib/import-file-types';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
import type { DiagramSources } from '@livediagram/document';
import type { InfraFile } from '@livediagram/document/infra-code';
import { InfraImportPanel } from './infra/InfraImportPanel';
import { InfraSourcesCard } from './infra/InfraSourcesCard';
import { InfraUpdatePanel } from './infra/InfraUpdatePanel';
import { Callout } from '@liveworkspace/ui/callout';

// The infrastructure import's runners and the tab's remembered files (docs/specs/020-import-export/
// infrastructure-import.md "The editor", "Updating a tab from its files").
export type InfraDialogApi = {
  // The active tab's files when it may be updated from them (an Editor's, unlocked), else null.
  sources: DiagramSources | null;
  importFiles: (files: InfraFile[], env?: string) => Promise<ImportOutcome>;
  update: (files: InfraFile[], env?: string) => Promise<ImportOutcome>;
};

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  // A binary format's panel hands over a dropped file instead of opening the picker.
  onImportFile: (
    format: Format,
    onProgress: (progress: ImportImageProgress) => void,
    dropped?: File,
  ) => Promise<ImportOutcome>;
  // Runs a text import (the paste/write path) for the chosen format,
  // bypassing the file picker (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md).
  onImportText: (
    format: Format,
    text: string,
    onProgress: (progress: ImportImageProgress) => void,
  ) => Promise<ImportOutcome>;
  // The formats offered, in catalogue order; absent offers every one. A single format opens straight at its
  // panel.
  formats?: readonly Format[];
  // Absent, the Infrastructure format is not offered (the start screen's import opens the board formats only).
  infra?: InfraDialogApi;
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
  note?: { article: 'markdownImport' | 'importTabs'; label: string };
  // A binary format (a .vsdx): no paste box, a drop target and a line saying where the file comes from.
  file?: { dropLabel: string; hint: string };
}[] = [
  {
    key: 'json',
    title: 'JSON',
    description:
      'A livediagram tab (a .json export). Restores its elements exactly. Paste it or pick a file.',
    placeholder: '{\n  "schemaVersion": 1,\n  "kind": "livediagram.tab",\n  "tab": { … }\n}',
  },
  {
    key: 'mermaid',
    title: 'Mermaid',
    description:
      'A Mermaid flowchart, state diagram, or ER diagram. Keeps every connection. Paste it or pick a file.',
    placeholder: 'flowchart TD\n  A([Start]) --> B{OK?}\n  B -->|yes| C[Ship]\n  B -->|no| A',
  },
  {
    key: 'markdown',
    title: 'Markdown',
    description:
      'A .md outline (headings + lists), e.g. exported from XMind. Becomes a themed tree.',
    placeholder: '# Project\n\n- Research\n  - Interviews\n  - Survey\n- Build\n- Launch',
    note: { article: 'markdownImport', label: 'See how a Markdown outline maps to a tree' },
  },
  {
    key: 'excalidraw',
    title: 'Excalidraw',
    description:
      'A .excalidraw scene, or a PNG / SVG exported with the scene. Keeps shapes, labels, connections, drawings, and images.',
    placeholder: '{\n  "type": "excalidraw",\n  "version": 2,\n  "elements": [ … ]\n}',
  },
  {
    key: 'drawio',
    title: 'draw.io',
    description:
      'A .drawio file, or a PNG / SVG with the diagram inside. Keeps shapes, text, connections and pages. Multi-page files add a tab for each further page.',
    placeholder:
      '<mxfile>\n  <diagram name="Page-1">\n    <mxGraphModel>…</mxGraphModel>\n  </diagram>\n</mxfile>',
    note: { article: 'importTabs', label: 'See what carries over from draw.io' },
  },
  {
    // docs/specs/020-import-export/visio-import.md "UI".
    key: 'visio',
    title: 'Visio',
    description:
      'A .vsdx from Visio, or a Lucidchart diagram exported as Visio (VSDX). Keeps shapes, text, connections and pages.',
    placeholder: '',
    note: { article: 'importTabs', label: 'See what carries over from Visio' },
    file: {
      dropLabel: 'Drop a .vsdx file here, or choose one',
      hint: 'From Lucidchart: File, Export, Visio (VSDX), then import that file.',
    },
  },
  {
    // docs/specs/020-import-export/bpmn-import.md "Where".
    key: 'bpmn',
    title: 'BPMN',
    description:
      'A .bpmn file from Camunda, bpmn.io, Signavio or any BPMN 2.0 modeler. Keeps every event, task, gateway, pool and flow where the modeler drew it.',
    placeholder:
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" …>\n  <bpmn:process id="Process_1">…</bpmn:process>\n  <bpmndi:BPMNDiagram>…</bpmndi:BPMNDiagram>\n</bpmn:definitions>',
    note: { article: 'importTabs', label: 'See how a BPMN file comes across' },
  },
  {
    // docs/specs/020-import-export/infrastructure-import.md "The editor".
    key: 'infra',
    title: 'Infrastructure',
    description:
      'wrangler.toml, Compose, Terraform or Kubernetes files, several at once. Draws each service with its bindings, dependencies and networks.',
    placeholder: '',
    note: { article: 'importTabs', label: 'See what each infrastructure file draws' },
  },
];

// Counterpart to ExportTabDialog: pick a format to import INTO the current
// tab. Importing REPLACES the tab's contents (docs/specs/020-import-export/markdown-import.md), so the dialog leads
// with a warning before the format cards. Every format is text, so each card
// opens the same two-step panel: paste/write the content, or pick a file
// (docs/specs/020-import-export/mermaid.md). Errors render inline; on success the dialog closes.
type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// An import shows its report when it met images, changed or dropped anything, or left a board out.
function needsReport(outcome: DoneOutcome): boolean {
  return (
    outcome.images !== undefined ||
    (outcome.scene !== undefined && reportHasLosses(outcome.scene)) ||
    (outcome.failures?.length ?? 0) > 0 ||
    (outcome.documents?.length ?? 0) > 0
  );
}

export function ImportTabDialog({
  tabName,
  onImportFile,
  onImportText,
  onClose,
  formats,
  infra,
}: ImportTabDialogProps) {
  const titleId = useId();
  const offered = (formats ? FORMATS.filter((f) => formats.includes(f.key)) : FORMATS).filter(
    (f) => f.key !== 'infra' || infra !== undefined,
  );
  // One format offered: no list to pick from, so its panel is the dialog.
  const only = offered.length === 1 ? offered[0]!.key : null;
  const [active, setActive] = useState<Format | null>(only);
  // The update from the tab's files, opened from its From Its Files card.
  const [updating, setUpdating] = useState(false);
  // Set once an import that met images, or brought a board across with changes, has landed: the
  // dialog then shows how it came across instead of closing.
  const [report, setReport] = useState<DoneOutcome | null>(null);
  const activeFormat = active ? FORMATS.find((f) => f.key === active) : null;
  const onDone = (outcome: DoneOutcome) => (needsReport(outcome) ? setReport(outcome) : onClose());
  const sources = infra?.sources ?? null;

  return (
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      {/* The dialog hero header (dialog-hero-header.md): files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title="Import to Tab"
        subtitle={
          report
            ? report.subtitle
              ? report.subtitle
              : report.scene
                ? "Here's how your board came across."
                : report.images
                  ? "Here's how your images came across."
                  : "Here's how your import came across."
            : updating
              ? 'Update this tab from new versions of its files.'
              : activeFormat?.key === 'infra'
                ? 'Add your infrastructure files, or paste one.'
                : activeFormat?.file
                  ? `Import your ${activeFormat.title} file.`
                  : activeFormat
                    ? `Paste your ${activeFormat.title}, or import a file.`
                    : 'Pick a format to import into the current tab.'
        }
        actions={<HelpArticleLink article="importTabs" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {report ? (
          <ImportImageReport
            report={report.images}
            scene={report.scene}
            failures={report.failures}
            documents={report.documents}
            {...(report.title ? { title: report.title } : {})}
            onDone={onClose}
          />
        ) : updating && infra && sources ? (
          <InfraUpdatePanel
            sources={sources}
            note={
              <HelpArticleLink
                article="importTabs"
                variant="text"
                label="See what an update keeps"
              />
            }
            onUpdate={infra.update}
            onDone={onDone}
            onBack={() => setUpdating(false)}
          />
        ) : (
          <ImportChooser
            tabName={tabName}
            activeFormat={activeFormat ?? null}
            formats={offered}
            onPick={setActive}
            single={only !== null}
            onImportFile={onImportFile}
            onImportText={onImportText}
            infra={infra}
            onUpdate={sources && active === null ? () => setUpdating(true) : undefined}
            onDone={onDone}
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
  infra,
  onUpdate,
}: {
  tabName: string;
  activeFormat: (typeof FORMATS)[number] | null;
  formats: typeof FORMATS;
  onPick: (format: Format | null) => void;
  single: boolean;
  onImportFile: ImportTabDialogProps['onImportFile'];
  onImportText: ImportTabDialogProps['onImportText'];
  infra?: InfraDialogApi;
  // Offered on the format list of a tab drawn from files: opens the update.
  onUpdate?: () => void;
  onDone: (outcome: Extract<ImportOutcome, { status: 'done' }>) => void;
}) {
  const note = activeFormat?.note ? (
    <HelpArticleLink
      article={activeFormat.note.article}
      variant="text"
      label={activeFormat.note.label}
    />
  ) : null;
  return (
    <>
      {onUpdate && infra?.sources ? (
        <InfraSourcesCard sources={infra.sources} onUpdate={onUpdate} />
      ) : null}
      {/* Destructive-action warning — this overwrites the tab. */}
      <Callout tone="warning" className="mb-4">
        This replaces everything on{' '}
        <strong className="font-semibold">{tabName || 'this tab'}</strong> with the imported
        content. Undo brings it back.
      </Callout>
      {activeFormat?.key === 'infra' && infra ? (
        <InfraImportPanel
          note={note}
          fileTypes={importFileTypes(activeFormat.key)}
          onImport={infra.importFiles}
          onDone={onDone}
          onBack={single ? undefined : () => onPick(null)}
        />
      ) : activeFormat?.file ? (
        <FileImportPanel
          formatTitle={activeFormat.title}
          dropLabel={activeFormat.file.dropLabel}
          hint={activeFormat.file.hint}
          note={note}
          fileTypes={importFileTypes(activeFormat.key)}
          onImportFile={(onProgress, dropped) =>
            onImportFile(activeFormat.key, onProgress, dropped)
          }
          onDone={onDone}
          onBack={single ? undefined : () => onPick(null)}
        />
      ) : activeFormat ? (
        <TextImportPanel
          formatTitle={activeFormat.title}
          placeholder={activeFormat.placeholder}
          fileTypes={importFileTypes(activeFormat.key)}
          /* Quiet footnote for this format. It used to sit under the picker
               grid, where it asked "Importing a Markdown outline?" of a reader
               who had not picked a format yet — an answer to a question nobody
               had. */
          note={note}
          onImportText={(text, onProgress) => onImportText(activeFormat.key, text, onProgress)}
          onImportFile={(onProgress) => onImportFile(activeFormat.key, onProgress)}
          onDone={onDone}
          onBack={single ? undefined : () => onPick(null)}
        />
      ) : (
        <div
          // Two columns on a phone: three left each card about 110px wide, its description wrapping to eight lines.
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {formats.map((f) => (
            <FormatCard
              key={f.key}
              title={f.title}
              description={f.description}
              fileTypes={importFileTypes(f.key)}
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
  const label =
    kind === 'mermaid'
      ? 'mmd'
      : kind === 'markdown'
        ? 'md'
        : kind === 'excalidraw'
          ? 'excali'
          : kind === 'drawio'
            ? 'drawio'
            : kind === 'visio'
              ? 'vsdx'
              : kind === 'bpmn'
                ? 'bpmn'
                : kind === 'infra'
                  ? 'infra'
                  : 'json';
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
