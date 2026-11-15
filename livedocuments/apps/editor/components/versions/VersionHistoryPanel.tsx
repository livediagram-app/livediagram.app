'use client';

// Version History (docs/specs/006-document/version-history.md "In the editor"; blueprint VH18, VH19): the window
// given over to one tab's earlier versions until closed. The selected version's pages on the left, drawn as the
// export draws them with what changed since outlined, and the rail on the right (under the pages on a phone). Opening
// a version is read-only; an Editor restores it (one changeset, seen live by everyone, undone from the toast) or makes
// a copy of it as a new tab. Loaded when first opened.
import { useId, useMemo, useRef, useState } from 'react';
import { versionChanges, type Tab } from '@livedocuments/document';
import { Button, CloseIcon, Select, useEscape, useFocusTrap } from '@livedocuments/ui';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import { NOW, VersionRail } from './VersionRail';
import { VersionDetail } from './VersionDetail';
import { VersionPreview } from './VersionPreview';
import { useVersionHistory, type RestoreOutcome, type VersionWho } from './useVersionHistory';
import { copyName, whenWords } from './version-words';

export type VersionHistoryPanelProps = {
  documentId: string;
  who: VersionWho;
  // The tabs this session may open, for the picker.
  tabs: readonly { id: string; name: string }[];
  tabId: string;
  // The tab as it is now; null while the editor is still reading it.
  nowTab: Tab | null;
  canEdit: boolean;
  // Make a Copy makes a tab: never through a link confined to one tab.
  canCopy: boolean;
  onShowTab: (tabId: string) => void;
  onClose: () => void;
};

const REFUSED: Record<
  Exclude<RestoreOutcome, { kind: 'restored' | 'unchanged' }>['reason'],
  string
> = {
  held: 'Someone is working on part of this tab. Try again once they let go.',
  busy: 'The tab kept changing. Try again.',
  gone: 'That version is no longer kept.',
  other: 'The version could not be restored. Try again.',
};

export function VersionHistoryPanel(props: VersionHistoryPanelProps) {
  const { documentId, who, tabs, tabId, nowTab, canEdit, canCopy, onClose } = props;
  const titleId = useId();
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<string>(NOW);
  const [showChanges, setShowChanges] = useState(true);
  const history = useVersionHistory({ documentId, tabId, who });
  const { list, bodies, open } = history;
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  useEscape(onClose);

  const version =
    selected === NOW || list.state !== 'ready'
      ? null
      : (list.versions.find((v) => v.id === selected) ?? null);
  const body = version ? bodies.get(version.id) : undefined;
  const versionTab = body?.state === 'ready' ? body.tab : null;
  // Worked out once per version and per change to the tab (the compiler memoises on both): about 3 ms for two
  // 2,000-element tabs.
  const changes = versionTab && nowTab ? versionChanges(versionTab, nowTab) : null;
  const marks =
    changes && showChanges
      ? { removed: new Set(changes.removed), changed: new Set(changes.changed) }
      : null;
  const tabName = tabs.find((t) => t.id === tabId)?.name ?? nowTab?.name ?? '';
  const imageContext = useMemo(
    () => ({ ownerId: who.ownerId, documentId, shareCode: who.shareCode }),
    [who.ownerId, who.shareCode, documentId],
  );

  const select = (id: string) => {
    setSelected(id);
    if (id !== NOW) void open(id);
  };

  const undoRestore = async (undoVersionId: string) => {
    const outcome = await history.restore({ id: undoVersionId, name: null });
    if (outcome.kind === 'failed') {
      toast.error(REFUSED[outcome.reason]);
      return;
    }
    track('Version', 'Undone', 'Editor');
    toast.action({ key: `version-restore-${tabId}`, message: 'Restore undone', actions: [] });
  };

  const restore = async () => {
    if (!version) return;
    const outcome = await history.restore(version);
    if (outcome.kind === 'failed') {
      toast.error(REFUSED[outcome.reason]);
      return;
    }
    if (outcome.kind === 'unchanged') {
      toast.info('Already the current version');
      return;
    }
    setSelected(NOW);
    toast.action({
      key: `version-restore-${tabId}`,
      message: `Restored the version kept ${whenWords(version.savedAt, now)}`,
      actions: [
        {
          label: 'Undo',
          ariaLabel: 'Undo the restore',
          onSelect: () => void undoRestore(outcome.undoVersionId),
        },
      ],
    });
  };

  const copy = async () => {
    if (!version) return;
    try {
      const made = await history.copy(version.id, copyName(tabName, version.savedAt));
      toast.action({
        key: `version-copy-${made.id}`,
        message: `Made a copy: “${made.name}”`,
        actions: [
          {
            label: 'Open',
            ariaLabel: `Open ${made.name}`,
            onSelect: () => {
              props.onShowTab(made.id);
              onClose();
            },
          },
        ],
      });
    } catch {
      toast.error('The copy could not be made. Try again.');
    }
  };

  const previewTab = version ? versionTab : nowTab;
  const previewLabel = version
    ? `Version kept ${whenWords(version.savedAt, now)}`
    : 'The tab as it is';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-slate-100 dark:bg-slate-950"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-900 sm:px-3">
        <Button variant="ghost" size="sm" aria-label="Close Version History" onClick={onClose}>
          <CloseIcon />
        </Button>
        <h2
          id={titleId}
          className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          Version History
        </h2>
        <span aria-hidden className="text-slate-300 dark:text-slate-600">
          ·
        </span>
        {tabs.length > 1 ? (
          <Select
            variant="ghost"
            size="sm"
            aria-label="Tab"
            value={tabId}
            className="min-w-0"
            selectClassName="max-w-[14rem] truncate"
            onChange={(e) => props.onShowTab(e.target.value)}
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">
            {tabName}
          </span>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="flex min-h-0 flex-1 flex-col">
          {version ? (
            <VersionDetail
              version={version}
              changes={nowTab ? changes : null}
              showChanges={showChanges}
              onShowChanges={setShowChanges}
              canEdit={canEdit}
              canCopy={canCopy}
              onRestore={restore}
              onCopy={copy}
              now={now}
            />
          ) : (
            <div className="border-b border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/80">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Now</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Choose a version from the list to see it and what has changed since.
              </p>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-8">
            {body?.state === 'failed' ? (
              <div
                role="alert"
                className="py-16 text-center text-sm text-slate-600 dark:text-slate-300"
              >
                <p>This version could not be read.</p>
                <Button
                  variant="ghost"
                  size="xs"
                  className="mt-2"
                  onClick={() => version && void open(version.id)}
                >
                  Try Again
                </Button>
              </div>
            ) : previewTab ? (
              <VersionPreview
                tab={previewTab}
                marks={version ? marks : null}
                imageContext={imageContext}
                label={previewLabel}
              />
            ) : (
              <div
                aria-busy="true"
                className="mx-auto aspect-video w-full max-w-3xl animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
              />
            )}
          </div>
        </main>
        <aside className="flex max-h-[45dvh] min-h-0 shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:max-h-none md:w-80 md:border-l md:border-t-0">
          <VersionRail
            list={list}
            selected={selected}
            onSelect={select}
            canEdit={canEdit}
            now={now}
            onRetry={() => void history.reload()}
            onNameCurrent={async (name) => {
              await history.nameCurrent(name);
              track('Version', 'Named', 'Editor');
            }}
            onRename={async (id, name) => {
              await history.rename(id, name);
              if (name !== null) track('Version', 'Named', 'Editor');
            }}
          />
        </aside>
      </div>
    </div>
  );
}
