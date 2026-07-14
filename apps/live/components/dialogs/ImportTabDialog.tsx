import { useState } from 'react';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';

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
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import to tab
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {activeFormat
              ? `Paste your ${activeFormat.title}, or import a file.`
              : 'Pick a format to import into the current tab.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="importTabs"
            title="Importing tabs"
            description="What you can import and how it replaces the tab."
          />
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
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
            placeholder={activeFormat.placeholder}
            onImportText={(text) => onImportText(activeFormat.key, text)}
            onImportFile={() => onImportFile(activeFormat.key)}
            onDone={onClose}
            onBack={() => setActive(null)}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {FORMATS.map((f) => (
                <ImportCard
                  key={f.key}
                  kind={f.key}
                  title={f.title}
                  description={f.description}
                  onClick={() => setActive(f.key)}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Importing a Markdown outline?{' '}
              <HelpArticleLink
                article="markdownImport"
                variant="text"
                label="See how it maps to a tree"
                title="Markdown import"
                description="How headings and lists become a themed tree diagram."
              />
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

function ImportCard({
  kind,
  title,
  description,
  onClick,
}: {
  kind: Format;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <div className="flex h-12 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        <FormatIcon kind={kind} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </button>
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
