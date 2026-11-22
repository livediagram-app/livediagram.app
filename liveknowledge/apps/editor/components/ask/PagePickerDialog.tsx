'use client';

// Choosing a page of this knowledgebase (Save as Page's parent, Always in Context's + Add a Page): the tree as an
// indented list with a filter, one page chosen, then confirmed. The list keeps one height whatever the filter
// leaves, so the dialog never jumps.
import { useId, useMemo, useState, type ReactNode } from 'react';
import { isConnectedRow, pageTreeRows } from '@liveknowledge/document';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  NoMatches,
  TextInput,
} from '@liveknowledge/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { PageIcon } from './ask-icons';

export type PickablePage = { id: string; name: string; parent?: string };

export function PagePickerDialog({
  title,
  about,
  confirmLabel,
  pages,
  initial,
  disabledReason,
  noteOf,
  busy = false,
  onPick,
  onClose,
}: {
  title: string;
  about: string;
  confirmLabel: string;
  pages: readonly PickablePage[];
  // The page chosen when the dialog opens.
  initial?: string | undefined;
  // Why a page cannot be chosen (already there, too large); it stays in the list, dimmed, saying why.
  disabledReason?: ((page: PickablePage) => string | undefined) | undefined;
  // A short note at a row's right (a page's size).
  noteOf?: ((page: PickablePage) => ReactNode) | undefined;
  busy?: boolean;
  onPick: (pageId: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | undefined>(initial);
  // Pages alone: a connected file in the tree is no page to ask about (links-and-embeds.md).
  const rows = useMemo(() => pageTreeRows(pages.filter((p) => !isConnectedRow(p))), [pages]);
  const words = query.trim().toLowerCase();
  // Filtered, the list is flat: a match is shown without the pages above it.
  const shown = words ? rows.filter((row) => row.page.name.toLowerCase().includes(words)) : rows;
  const chosenPage = pages.find((page) => page.id === chosen);
  const canConfirm = !!chosenPage && !disabledReason?.(chosenPage) && !busy;

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <DialogHeader title={<span id={titleId}>{title}</span>} subtitle={about}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-4">
        <TextInput
          type="search"
          value={query}
          aria-label="Find a page"
          placeholder="Find a page"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          role="listbox"
          aria-label="Pages"
          className="h-72 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700"
        >
          {shown.length === 0 ? (
            <NoMatches
              things="pages"
              query={query}
              icon={<PageIcon />}
              onClear={() => setQuery('')}
              className="h-full"
            />
          ) : (
            shown.map(({ page, depth }) => {
              const reason = disabledReason?.(page);
              const selected = page.id === chosen;
              return (
                <button
                  key={page.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={reason ? true : undefined}
                  data-page-option={page.id}
                  onClick={() => (reason ? undefined : setChosen(page.id))}
                  onDoubleClick={() => (reason || busy ? undefined : onPick(page.id))}
                  style={{ paddingLeft: 8 + (words ? 0 : (depth - 1) * 16) }}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 ${
                    reason
                      ? 'cursor-not-allowed text-slate-500 dark:text-slate-400'
                      : selected
                        ? 'cursor-pointer bg-brand-100 text-brand-900 dark:bg-brand-500/25 dark:text-brand-50'
                        : 'cursor-pointer text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span aria-hidden className="shrink-0 opacity-70">
                    <PageIcon />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{page.name || 'Untitled Page'}</span>
                  {reason ? (
                    <span className="shrink-0 text-xs">{reason}</span>
                  ) : noteOf ? (
                    <span className="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      {noteOf(page)}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!canConfirm}
          busy={busy}
          onClick={() => (chosen ? onPick(chosen) : undefined)}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
