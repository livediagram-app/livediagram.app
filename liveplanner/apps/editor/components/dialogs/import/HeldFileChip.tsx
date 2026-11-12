'use client';

// A large tab JSON dropped on the Import dialog, held in the paste box's place (plan-tabs.md "The Import dialog"): the
// file's glyph, its name and size, and Remove, which brings the box back. Import then imports it straight from the
// file; the box never holds it.
import { Button, lucideGlyph } from '@liveplanner/ui';
import { lucideFileText } from '@liveworkspace/icons/lucide';
import { fileSizeLabel } from './import-drop';

const FileGlyph = lucideGlyph(lucideFileText, 20);

export type HeldFile = { name: string; bytes: number; text: string };

export function HeldFileChip({
  file,
  onRemove,
  disabled,
}: {
  file: HeldFile;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div
      data-testid="held-file"
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-brand-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-brand-300 dark:ring-slate-700">
        <FileGlyph />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {file.name}
        </span>
        <span className="block text-[12px] text-slate-500 dark:text-slate-400">
          {fileSizeLabel(file.bytes)}, ready to import
        </span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
      >
        Remove
      </Button>
    </div>
  );
}
