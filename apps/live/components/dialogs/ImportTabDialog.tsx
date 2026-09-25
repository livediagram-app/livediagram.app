import { useState } from 'react';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { FormatCard } from './FormatCard';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import { DialogHeader } from './DialogHeader';

type Format = 'json' | 'markdown' | 'mermaid' | 'excalidraw';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImportFile: (format: Format) => Promise<ImportOutcome>;
  // Runs a text import (the paste/write path) for the chosen format,
  // bypassing the file picker (spec/27 + spec/73).
  onImportText: (format: Format, text: string) => Promise<ImportOutcome>;
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
      'A .excalidraw scene. Keeps shapes, labels, connections, and drawings. Paste it or pick a file.',
    placeholder: '{\n  "type": "excalidraw",\n  "version": 2,\n  "elements": [ … ]\n}',
  },
];

// Counterpart to ExportTabDialog: pick a format to import INTO the current
// tab. Importing REPLACES the tab's contents (spec/27), so the dialog leads
// with a warning before the format cards. Every format is text, so each card
// opens the same two-step panel: paste/write the content, or pick a file
// (spec/73). Errors render inline; on success the dialog closes.
export function ImportTabDialog({
  tabName,
  onImportFile,
  onImportText,
  onClose,
}: ImportTabDialogProps) {
  const [active, setActive] = useState<Format | null>(null);
  const activeFormat = active ? FORMATS.find((f) => f.key === active) : null;

  return (
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      <DialogHeader
        title="Import to tab"
        subtitle={
          activeFormat
            ? `Paste your ${activeFormat.title}, or import a file.`
            : 'Pick a format to import into the current tab.'
        }
      >
        <HelpArticleLink article="importTabs" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Destructive-action warning — this overwrites the tab. */}
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="mt-0.5 shrink-0">
            <WarningIcon />
          </span>
          <span>
            This replaces everything on{' '}
            <strong className="font-semibold">{tabName || 'this tab'}</strong> with the imported
            content. Undo (⌘Z / Ctrl&#8209;Z) brings it back.
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
            onDone={onClose}
            onBack={() => setActive(null)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {FORMATS.map((f) => (
              <FormatCard
                key={f.key}
                title={f.title}
                description={f.description}
                onClick={() => setActive(f.key)}
              >
                <FormatIcon kind={f.key} />
              </FormatCard>
            ))}
          </div>
        )}
      </div>
    </Dialog>
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

function WarningIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5 1.5 14h13L8 2.5Z" />
      <path d="M8 6.5v3.5" />
      <path d="M8 12h.01" />
    </svg>
  );
}
