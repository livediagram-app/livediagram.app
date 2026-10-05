import type {
  ChangesetResponse,
  ChangesetWritten,
  EditRejection,
  LintReport,
} from '@livediagram/api-schema';
import { lintFooterPart } from '@livediagram/diagram-lint';
import { migrateIncomingTab, preferNewerQaAll, type Tab } from '@livediagram/document';
import {
  applyEditOperations,
  applyReplace,
  formatResultFooter,
  formatResultLines,
  type ApplySuccess,
} from '@livediagram/edit-operations';
import { rewriteCommentAuthors } from '../comments';
import { lastChangesetRev, tabIdsHeldElsewhere } from '../db';
import { capStoredName } from '../names';
import { personTagFor } from '../person-tag';
import { readRoomSelections, type RoomSelection } from '../room-client';
import type { DocumentDTO, Env } from '../types';
import { afterChangeset } from './after';
import { checkBase, type BaseOutcome } from './base-check';
import type { FrontDoor } from './front-door';
import { heldTargets } from './held-check';
import { lintResult } from './lint';
import { changesetLog, engineLog } from './log';
import { engineRefusal, type ParsedChangeset } from './request';
import { readStoredTab, withRev, type StoredTab } from './stored-tab';
import { writeChangeset, type Author } from './write';

// The changeset pipeline (docs/specs/024-agents/agent-changesets.md "The write path"; blueprint "The
// pipeline"): read, compile, check the base, check held, then write at the revision read. A lost
// race repeats once from the read, so the second attempt compiles against the winner's tab.

export const SUBMIT_ATTEMPTS = 2;
// Longer than any id an editor or agent mints, short enough to keep keys sane (CS31).
const TAB_ID_MAX = 128;

export type SubmitArgs = {
  env: Env;
  document: DocumentDTO;
  tabId: string;
  request: ParsedChangeset;
  dryRun: boolean;
  author: Author;
  tokenId: string | null;
  frontDoor: FrontDoor;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export type SubmitResult = { status: number; body: unknown };

type Where = { documentId: string; tabId: string };

export async function submitChangeset(args: SubmitArgs): Promise<SubmitResult> {
  const { env, document, tabId, request } = args;
  const where: Where = { documentId: document.id, tabId };
  if (tabId.length > TAB_ID_MAX) {
    return refusal(422, 'invalid_value', `a tab id holds at most ${TAB_ID_MAX} characters`);
  }
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    const [stored, prevRev, selections] = await Promise.all([
      readStoredTab(env, document.id, tabId),
      lastChangesetRev(env, tabId),
      args.tokenId ? readSelections(env, document.id, tabId, args.author.id) : null,
    ]);
    if (!stored) {
      if (request.body.kind !== 'replace') return { status: 404, body: { error: 'not_found' } };
      if ((await tabIdsHeldElsewhere(env, document.id, [tabId])).size > 0) {
        return refusal(409, 'tab_id_taken', 'another document holds a tab with this id');
      }
    }
    const compiled = compile(args, stored, selections);
    if ('errors' in compiled) return rejected(args, stored, compiled.errors, where);
    const base = checkBase(
      request.base,
      withRev(stored),
      compiled.targets,
      compiled.createdIds,
      request.strict,
    );
    if (!base.ok) return baseRefusal(args, base, where);
    if (args.tokenId) {
      const held = heldTargets(compiled.targets, selections);
      if (held.length > 0) {
        changesetLog('info', '[changeset] held', { ...where, held: held.length });
        args.waitUntil?.(afterChangeset.telemetry(env, 'Held', args.frontDoor));
        return { status: 409, body: { error: 'elements_held', held } };
      }
    }
    const warnings = [...base.warnings, ...compiled.warnings.map((w) => w.code)];
    const lines = formatResultLines(compiled.results);
    if (args.dryRun) {
      changesetLog('info', '[changeset] dry-run', { ...where, targets: compiled.targets.length });
      const lint = lintResult(compiled.tab, where);
      const footer = formatResultFooter({
        dryRun: true,
        rev: stored?.rev ?? 0,
        lint: lintFooterPart(lint),
      });
      return answer({
        dryRun: true,
        changeset: null,
        results: compiled.results,
        text: [...lines, footer].join('\n'),
        warnings,
        lint,
      });
    }
    const next = withServerRules(compiled.tab, stored, args.author);
    const lint = lintResult(next, where);
    const outcome = await writeChangeset(env, {
      documentId: document.id,
      tabId,
      stored,
      next,
      orderIndex: stored?.orderIndex ?? document.tabs.length,
      author: args.author,
      tokenId: args.tokenId,
      summary: request.summary,
      baseRev: request.base?.rev ?? null,
      rebasedOver: base.rebasedOver,
      prevRev,
      results: compiled.results,
      textFor: (written) => [...lines, writtenFooter(written, document.id, lint)].join('\n'),
      revertOf: null,
    });
    if (outcome.kind === 'stale') {
      changesetLog('warn', '[changeset] lost-race', { ...where, attempt });
      continue;
    }
    if (outcome.kind === 'too_large')
      return refusal(413, 'too_large', 'the changeset or the tab it leaves is over the cap');
    if (outcome.kind === 'unchanged') {
      // Nothing to write, record or relay (CS11).
      return answer({
        dryRun: false,
        changeset: null,
        results: compiled.results,
        text: [...lines, 'nothing changed'].join('\n'),
        warnings,
        lint: null,
      });
    }
    changesetLog('info', '[changeset] applied', {
      ...where,
      changesetId: outcome.written.id,
      rev: outcome.written.rev,
      rebasedOver: outcome.written.rebasedOver,
      ...outcome.record.counts,
      agent: args.tokenId !== null,
    });
    args.waitUntil?.(
      afterChangeset.run(env, {
        document,
        author: args.author,
        next,
        stored: stored?.tab ?? null,
        agent: args.tokenId !== null,
        frontDoor: args.frontDoor,
        action: 'Applied',
      }),
    );
    return answer({
      dryRun: false,
      changeset: outcome.written,
      results: compiled.results,
      text: outcome.text,
      warnings,
      lint,
    });
  }
  return refusal(409, 'tab_busy', 'the tab kept changing; read it again and resubmit');
}

export function writtenFooter(
  written: ChangesetWritten,
  documentId: string,
  lint: LintReport | null,
): string {
  return formatResultFooter({
    dryRun: false,
    previousRev: written.previousRev,
    rev: written.rev,
    rebasedOver: written.rebasedOver,
    changesetId: written.id,
    documentId,
    lint: lintFooterPart(lint),
  });
}

// The selections on the tab, the agent owner's own marked by their person tag.
async function readSelections(
  env: Env,
  documentId: string,
  tabId: string,
  ownerId: string,
): Promise<RoomSelection[] | null> {
  return readRoomSelections(env, documentId, tabId, await personTagFor(documentId, ownerId));
}

function compile(
  args: SubmitArgs,
  stored: StoredTab | null,
  selections: readonly RoomSelection[] | null,
): ApplySuccess | { errors: EditRejection[] } {
  const options = {
    // What the owner has selected: what `selected` reads; null when the room was not read.
    selected: selections ? selections.filter((s) => s.mine).flatMap((s) => s.elementIds) : null,
    log: engineLog({ documentId: args.document.id, tabId: args.tabId }),
  };
  const body = args.request.body;
  if (body.kind === 'replace') {
    return applyReplace(stored?.tab ?? null, body.replace, {
      ...options,
      tabId: args.tabId,
      name: body.name ?? 'Tab',
      ...(body.theme ? { themeId: body.theme } : {}),
    });
  }
  if (!stored)
    return { errors: [{ code: 'target_not_found', details: ['the tab does not exist'] }] };
  return applyEditOperations(stored.tab, body.operations, options);
}

// The engine refused. When the base is behind, a conflict over what the agent read wins: that is
// what the agent must re-read for (CS13).
function rejected(
  args: SubmitArgs,
  stored: StoredTab | null,
  errors: EditRejection[],
  where: Where,
): SubmitResult {
  const base = args.request.base;
  if (base && stored && base.rev < stored.rev) {
    const early = checkBase(base, withRev(stored), [], [], args.request.strict);
    if (!early.ok) return baseRefusal(args, early, where);
  }
  changesetLog('info', '[changeset] rejected', {
    ...where,
    codes: errors.map((e) => e.code).join(','),
  });
  const r = engineRefusal(errors);
  return { status: r.status, body: r.body };
}

// The rules every tab write meets (CS30): migrated elements, a created tab's name capped, Q&A
// notes kept at their newest, new comments credited to the author whatever the body claimed.
function withServerRules(tab: Tab, stored: StoredTab | null, author: Author): Tab {
  const migrated = migrateIncomingTab(tab) as Tab;
  const previous = stored?.tab.elements ?? [];
  const elements = rewriteCommentAuthors(
    stored ? preferNewerQaAll(previous, migrated.elements) : migrated.elements,
    previous,
    { id: author.id, name: author.name, color: author.color, createdAt: 0, pictureUrl: null },
  );
  const name = stored ? stored.tab.name : capStoredName(migrated.name, null, 'tab');
  return { ...migrated, name, elements };
}

function baseRefusal(
  args: SubmitArgs,
  outcome: Exclude<BaseOutcome, { ok: true }>,
  where: Where,
): SubmitResult {
  if (outcome.status === 409 || outcome.status === 412) {
    changesetLog('info', '[changeset] conflict', {
      ...where,
      conflicts: outcome.status === 409 ? outcome.conflicts.length : 0,
      strict: args.request.strict,
    });
    if (args.tokenId)
      args.waitUntil?.(afterChangeset.telemetry(args.env, 'Conflicted', args.frontDoor));
  }
  const { ok: _ok, status, ...body } = outcome;
  return { status, body };
}

function refusal(status: number, error: string, message: string): SubmitResult {
  return { status, body: { error, message } };
}

function answer(body: ChangesetResponse): SubmitResult {
  return { status: 200, body };
}
