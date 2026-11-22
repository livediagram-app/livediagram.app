// liveknowledge' own steps as a rule runs them (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint
// automations.md "The kit"): Name This Version, through the route's own path (versions/name-current.ts), and Restore
// a Version, through the Restore route's (versions/restore.ts restoreVersion): one changeset by Automation, the
// content it replaces kept first so it can be undone, the room's ops relayed. Each queues its version event with the
// run's source, so the chain rules decide whether it starts another rule. And `owns`: which versions a rule names
// are still named versions, for the Rules list.
import { truncateName } from '@liveknowledge/document';
import { VERSION_NAMED_MAX } from '@liveknowledge/api-schema';
import {
  NAME_VERSION_STEP,
  RESTORE_VERSION_STEP,
  VERSION_REF,
  type NameVersionStep,
  type RestoreVersionStep,
} from '@liveknowledge/document/automations';
import { RUN_TAB } from '@liveworkspace/automations/item';
import {
  NAME_EMPTY,
  automationAuthor,
  type ItemActionContext,
  type ItemActionRunner,
  type StepOutcome,
} from '@liveworkspace/automations/room';
import { getDocument, getVersion } from '../../db';
import type { DocumentEnv } from '../../types';
import { nameCurrentVersion } from '../../versions/name-current';
import { restoreVersion } from '../../versions/restore';
import { ruleWho } from './version-events';

export const NO_RUN_TAB = 'This run has no tab to name';
export const TAB_GONE = 'The tab is gone';
export const VERSION_GONE = 'The version is gone';
export const TAB_BUSY = 'The tab kept changing';
export const namesFullWords = `This tab has ${VERSION_NAMED_MAX} named versions`;

const failed = (text: string): StepOutcome => ({ ok: false, text });
const tabGone = (id: string): StepOutcome => ({
  ok: false,
  text: TAB_GONE,
  gone: { kind: 'tab', id },
});
const versionGone = (id: string): StepOutcome => ({
  ok: false,
  text: VERSION_GONE,
  gone: { kind: VERSION_REF.field, id },
});

const tabName = (ctx: ItemActionContext, id: string): string =>
  ctx.outline.tabs.find((t) => t.id === id)?.name ?? 'the tab';

async function nameVersion(
  env: DocumentEnv,
  documentId: string,
  step: NameVersionStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> {
  const tabId = step.tab === RUN_TAB ? ctx.tab?.id : step.tab;
  if (!tabId) return failed(NO_RUN_TAB);
  if (!ctx.outline.tabs.some((t) => t.id === tabId)) return tabGone(tabId);
  const name = truncateName(ctx.fill(step.name).trim());
  if (!name) return failed(NAME_EMPTY);
  const outcome = await nameCurrentVersion(env, {
    documentId,
    tabId,
    name,
    author: () => automationAuthor(ctx),
    who: () => ruleWho(ctx),
  });
  if (outcome.ok)
    return { ok: true, text: `Named the current version of ${tabName(ctx, tabId)} “${name}”` };
  if (outcome.reason === 'too_many_names') return failed(namesFullWords);
  return outcome.reason === 'tab_busy' ? failed(TAB_BUSY) : tabGone(tabId);
}

async function restore(
  env: DocumentEnv,
  documentId: string,
  step: RestoreVersionStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> {
  const document = await getDocument(env, documentId);
  if (!document || !document.tabs.some((t) => t.id === step.tab)) return tabGone(step.tab);
  const version = step.version ? await getVersion(env, step.tab, step.version) : null;
  // Only a named version is the rule's to restore: one unnamed since is gone to it.
  if (!version || version.summary.name === null) return versionGone(step.version);
  const result = await restoreVersion({
    env,
    document,
    tabId: step.tab,
    version,
    author: automationAuthor(ctx),
    tokenId: null,
    who: ruleWho(ctx),
  });
  const tab = tabName(ctx, step.tab);
  const named = `“${version.summary.name}”`;
  if (result.status === 200)
    return result.body.restored
      ? { ok: true, text: `Restored ${tab} to ${named}` }
      : { ok: true, text: `${tab} already matched ${named}` };
  if (result.status === 404) return versionGone(step.version);
  if (result.status === 413) return failed('That version no longer fits a tab');
  return failed(TAB_BUSY);
}

/** The two steps' runners, by kind. */
export function versionRunners(
  env: DocumentEnv,
  documentId: string,
): Readonly<Record<string, ItemActionRunner>> {
  return {
    [NAME_VERSION_STEP]: (action, ctx) =>
      nameVersion(env, documentId, action as unknown as NameVersionStep, ctx),
    [RESTORE_VERSION_STEP]: (action, ctx) =>
      restore(env, documentId, action as unknown as RestoreVersionStep, ctx),
  };
}

// Ids asked a query at a time: two lists of them, well under a statement's bound parameters.
const OWNS_CHUNK = 40;

/** Which of `ids` are still named versions of the document's tabs (the kit's `owns`, for `version`). */
export async function namedVersionsOf(
  env: DocumentEnv,
  ids: readonly string[],
): Promise<ReadonlySet<string>> {
  const held = new Set<string>();
  for (let i = 0; i < ids.length; i += OWNS_CHUNK) {
    const chunk = ids.slice(i, i + OWNS_CHUNK);
    const marks = chunk.map(() => '?').join(', ');
    const rows = await env.DOCUMENT_DB.prepare(
      `SELECT m.snapshot_id AS id FROM tab_named_versions m JOIN snapshots s ON s.id = m.snapshot_id
         WHERE m.snapshot_id IN (${marks}) AND s.name IS NOT NULL
       UNION ALL
       SELECT id FROM tab_versions WHERE id IN (${marks}) AND name IS NOT NULL`,
    )
      .bind(...chunk, ...chunk)
      .all<{ id: string }>();
    for (const row of rows.results ?? []) held.add(row.id);
  }
  return held;
}
