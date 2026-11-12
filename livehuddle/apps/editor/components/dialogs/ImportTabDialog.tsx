import { useId } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TextImportPanel } from './TextImportPanel';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportImageProgress } from '@/lib/import-images';
import type { ImportFormat as Format } from '@/hooks/persistence/useTabImport';
import { Glyph } from '@livehuddle/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs a file import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImportFile: (
    format: Format,
    onProgress: (progress: ImportImageProgress) => void,
  ) => Promise<ImportOutcome>;
  // Runs a text import (the paste/write path) for the chosen format,
  // bypassing the file picker.
  onImportText: (
    format: Format,
    text: string,
    onProgress: (progress: ImportImageProgress) => void,
  ) => Promise<ImportOutcome>;
  onClose: () => void;
};

// The one format: a livehuddle tab's JSON, and the paste panel's placeholder.
const JSON_FORMAT: Format = 'json';
const JSON_PLACEHOLDER = '{\n  "schemaVersion": 1,\n  "kind": "livehuddle.tab",\n  "tab": { … }\n}';

// Counterpart to ExportTabDialog: import a livehuddle tab's JSON INTO the current tab (backup and restore).
// Importing REPLACES the tab's contents, so the dialog leads with a warning before the paste-or-file panel. Errors
// render inline; on success the dialog closes. Imports from other tools are gone from livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools"), so there is no format to pick.
export function ImportTabDialog({
  tabName,
  onImportFile,
  onImportText,
  onClose,
}: ImportTabDialogProps) {
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      {/* The dialog hero header (dialog-hero-header.md): files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title="Import to Tab"
        subtitle="Paste your JSON, or import a file."
        actions={<HelpArticleLink article="importTabs" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Destructive-action warning: this overwrites the tab. */}
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
        <TextImportPanel
          formatTitle="JSON"
          placeholder={JSON_PLACEHOLDER}
          onImportText={(text, onProgress) => onImportText(JSON_FORMAT, text, onProgress)}
          onImportFile={(onProgress) => onImportFile(JSON_FORMAT, onProgress)}
          onDone={onClose}
        />
      </div>
    </Dialog>
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
