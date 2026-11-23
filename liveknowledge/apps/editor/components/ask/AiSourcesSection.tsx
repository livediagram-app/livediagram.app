'use client';

// AI Settings > Sources (docs/specs/030-knowledgebase/search-and-ask.md "Sources in AI Settings"): what Ask answers
// from besides this knowledgebase's pages. The pages always; Connected Items (the diagrams, plans, documents,
// designs and Spaces connected in the sidebar), on unless an Editor turns it off; and, for a team knowledgebase, one
// of the team's folders, none unless an Editor chooses one. Then the sources themselves, each with its app and how far
// it is read. Every role sees it; an Editor changes it. Each reader is answered only from the items they can open,
// and guests and people on a share link from the pages alone.
import { useEffect, useId, useState } from 'react';
import type { KnowledgeSourceRow, KnowledgeSources } from '@liveknowledge/api-schema';
import { AppMark, Chip, Select, Switch } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { Folder } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  apiKnowledgeSources,
  apiSetKnowledgeSources,
  type KnowledgeCaller,
} from '@/lib/api/knowledge';
import { shortDate } from '@/lib/knowledge/page-trust';
import { track } from '@/lib/telemetry';

const SECTION_TITLE = 'text-[13px] font-semibold text-slate-900 dark:text-slate-100';
const NOTE = 'text-xs leading-relaxed text-slate-600 dark:text-slate-400';
const ROW = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5';
const ROW_NAME = 'text-sm font-medium text-slate-900 dark:text-slate-100';
/** Sources listed before "and N more". */
export const SOURCES_SHOWN = 8;
/** Team folders the picker offers at most (one page of the index's list). */
const FOLDERS_MAX = 200;

/** How far a source is read, in a few words. */
export function sourceStateWords(row: KnowledgeSourceRow, now: number): string {
  if (row.state === 'read') return row.readAt ? `Read ${shortDate(row.readAt, now)}` : 'Read';
  if (row.state === 'capped') return 'Over the Limit';
  if (row.state === 'failed') return "Couldn't Read";
  return 'Reading Soon';
}

// One stable function, so the folders are asked for once, not on every draw.
const teamFolders = (team: string): Promise<Folder[]> =>
  indexClient.listFolders({ team, limit: FOLDERS_MAX }).then((page) => page.folders);

type Load =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; sources: KnowledgeSources };

export function AiSourcesSection({
  who,
  documentId,
  manage,
  now: nowGiven,
  loadFolders = teamFolders,
}: {
  who: KnowledgeCaller;
  documentId: string;
  /** An Editor's: the switch and the folder picker. */
  manage: boolean;
  now?: number;
  loadFolders?: (teamId: string) => Promise<Folder[]>;
}) {
  const titleId = useId();
  const [openedAt] = useState(() => Date.now());
  const now = nowGiven ?? openedAt;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    apiKnowledgeSources(who, documentId, abort.signal).then(
      (sources) => setLoad({ status: 'ready', sources }),
      () => {
        if (!abort.signal.aborted) setLoad({ status: 'failed' });
      },
    );
    return () => abort.abort();
  }, [who, documentId]);

  const teamId = load.status === 'ready' ? load.sources.teamId : null;
  // The team's folders, asked for once an Editor may choose one.
  useEffect(() => {
    if (!manage || !teamId) return;
    let live = true;
    loadFolders(teamId).then(
      (found) => live && setFolders(found),
      () => live && setFolders([]),
    );
    return () => {
      live = false;
    };
  }, [manage, teamId, loadFolders]);

  const change = async (body: Parameters<typeof apiSetKnowledgeSources>[2], type: string) => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      setLoad({ status: 'ready', sources: await apiSetKnowledgeSources(who, documentId, body) });
      track('UI', 'Changed', type);
    } catch {
      setFailure("Sources couldn't be changed just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const sources = load.status === 'ready' ? load.sources : null;
  const items = sources?.items ?? [];
  const shown = items.slice(0, SOURCES_SHOWN);
  return (
    <section
      aria-labelledby={titleId}
      data-ai-sources=""
      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className={SECTION_TITLE}>
          Sources
        </h3>
        <p className={NOTE}>
          What Ask answers from. Each person gets answers only from the items they can open
          themselves; guests and people on a share link get answers from pages only.
        </p>
      </div>
      <div className={ROW} data-source-choice="pages">
        <span className={ROW_NAME}>This Knowledgebase</span>
        <Chip className="bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Always
        </Chip>
      </div>
      <div className="flex flex-col gap-1" data-source-choice="connected">
        <div className={ROW}>
          <span className={ROW_NAME}>Connected Items</span>
          {sources && manage ? (
            <Switch
              size="sm"
              checked={sources.connected}
              label="Connected Items"
              disabled={busy}
              onChange={(on) =>
                void change({ connected: on }, on ? 'SourcesConnectedOn' : 'SourcesConnectedOff')
              }
            />
          ) : sources ? (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {sources.connected ? 'On' : 'Off'}
            </span>
          ) : null}
        </div>
        <p className={NOTE}>
          The diagrams, plans, documents, designs and Spaces connected in the sidebar: their shapes,
          cards, slides and meeting notes.
        </p>
      </div>
      {sources?.teamId ? (
        <div className="flex flex-col gap-1" data-source-choice="folder">
          <div className={ROW}>
            <span id={`${titleId}-folder`} className={ROW_NAME}>
              A Team Folder
            </span>
            {manage ? (
              <Select
                aria-labelledby={`${titleId}-folder`}
                value={sources.folderId ?? ''}
                disabled={busy || folders === null}
                selectClassName="min-w-[12rem]"
                onChange={(event) => {
                  const id = event.target.value || null;
                  const name = folders?.find((f) => f.id === id)?.name ?? null;
                  void change(
                    { folderId: id, folderName: name },
                    id ? 'SourcesFolderOn' : 'SourcesFolderOff',
                  );
                }}
              >
                <option value="">None</option>
                {/* The chosen folder stays offered while the list loads, or once it is gone from it. */}
                {sources.folderId && !folders?.some((f) => f.id === sources.folderId) ? (
                  <option value={sources.folderId}>{sources.folderName || 'Chosen Folder'}</option>
                ) : null}
                {(folders ?? []).map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {sources.folderId ? sources.folderName || 'Chosen' : 'None'}
              </span>
            )}
          </div>
          <p className={NOTE}>
            Everything in one of the team&apos;s folders and the folders in it.
          </p>
        </div>
      ) : null}
      {load.status === 'failed' ? (
        <p className={NOTE} role="status">
          Sources couldn&apos;t be read just now.
        </p>
      ) : items.length > 0 ? (
        <ul
          data-source-items=""
          className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800"
        >
          {shown.map((row) => (
            <li key={row.itemId} className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
              <AppMark app={row.app} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">
                {row.title || 'Untitled'}
              </span>
              <span
                data-source-state={row.state}
                className={`shrink-0 text-xs ${
                  row.state === 'read'
                    ? 'text-slate-600 dark:text-slate-400'
                    : 'font-medium text-amber-800 dark:text-amber-200'
                }`}
              >
                {sourceStateWords(row, now)}
              </span>
            </li>
          ))}
          {items.length > shown.length ? (
            <li className={`${NOTE} py-1.5`}>and {items.length - shown.length} more</li>
          ) : null}
        </ul>
      ) : sources ? (
        <p className={NOTE}>No connected items yet. Connect a file in the sidebar to add one.</p>
      ) : null}
      {failure ? (
        <Callout tone="error" size="md" role="alert">
          {failure}
        </Callout>
      ) : null}
    </section>
  );
}
